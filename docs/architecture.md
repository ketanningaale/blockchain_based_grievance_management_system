# Technical Architecture

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser / Client                         │
│                  Next.js 14 (Vercel) — TypeScript                │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS  (Bearer token)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FastAPI Backend (Render.com)                    │
│  ┌────────────┐  ┌──────────┐  ┌───────────┐  ┌─────────────┐  │
│  │  Auth /    │  │Grievance │  │ Committee │  │HoD/Principal│  │
│  │  verify    │  │  router  │  │  router   │  │  routers    │  │
│  └────────────┘  └──────────┘  └───────────┘  └─────────────┘  │
│  ┌────────────┐  ┌──────────┐  ┌───────────┐  ┌─────────────┐  │
│  │ Blockchain │  │ Firebase │  │   IPFS    │  │  SendGrid   │  │
│  │  service   │  │ service  │  │  service  │  │   service   │  │
│  └────────────┘  └──────────┘  └───────────┘  └─────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               APScheduler (in-process)                    │   │
│  │  threshold_watchdog (30 min)  email_queue_processor (1 min)│  │
│  └──────────────────────────────────────────────────────────┘   │
└────────────┬──────────────┬───────────────┬────────────────────┘
             │              │               │
             ▼              ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │  Blockchain  │ │   Firebase   │ │   Pinata     │
    │ (Besu/Sepolia│ │  Firestore + │ │   (IPFS)     │
    │  via Alchemy)│ │     Auth     │ │              │
    └──────────────┘ └──────────────┘ └──────────────┘
```

---

## Components

### Frontend (Next.js 14, Vercel)

- **App Router** with role-scoped route groups: `(auth)`, `student`, `committee`, `hod`, `principal`, `admin`.
- **Edge Middleware** (`middleware.ts`) reads a `grievance_role` cookie set at login and redirects unauthorized requests before they reach the page.
- **TanStack Query** handles all API data fetching with background refetching and cache invalidation.
- **Firebase client SDK** owns auth state. `useAuth` hook exposes `UserProfile` (Firebase claims + Firestore profile merged) to all pages.
- **Axios instance** (`lib/api.ts`) automatically attaches a fresh `Authorization: Bearer <firebase-id-token>` to every request.

### Backend (FastAPI, Render.com)

- Single Python process. Async throughout using `asyncio`.
- **Dependency injection**: `get_current_user` verifies the Firebase token on every protected route; `require_role()` enforces role-level access.
- **Relay wallet pattern**: The backend holds one Ethereum private key (`RELAY_WALLET_PRIVATE_KEY`). All blockchain transactions are signed and sent by this wallet. `msg.sender` in the contract is always the relay wallet — smart contract access control is enforced via OpenZeppelin `AccessControl` roles granted to this address.
- **BackgroundTasks**: The grievance submission endpoint returns `202 Accepted` immediately after IPFS upload and runs the blockchain transaction + Firestore write in a FastAPI `BackgroundTask`. This avoids Render's 30-second HTTP connection timeout on slow networks like Sepolia.

### Blockchain (Hardhat / Besu / Sepolia)

Two contracts are deployed per institute:

| Contract | Purpose |
|---|---|
| `RoleManager` | OpenZeppelin `AccessControl` — grants and revokes the 5 roles (STUDENT, COMMITTEE, HOD, PRINCIPAL, ADMIN) |
| `GrievanceSystem` | Full grievance lifecycle — submission, committee voting, authority actions, auto-escalation, feedback |

`GrievanceFactory` is available for multi-institute deployments but not required for single-institute use.

### Firebase

| Collection | Description |
|---|---|
| `users/{uid}` | User profile: displayName, email, role, department, instituteId, walletAddress |
| `grievances/{grievanceId}` | Firestore cache of on-chain state — enables fast listing without blockchain RPC calls |
| `notifications/{uid}/items/{notifId}` | In-app notification feed; frontend listens in real time |
| `email_queue/{docId}` | Pending outbound emails; APScheduler dispatches via SendGrid every minute |
| `institutes/{instituteId}` | Institute config: thresholds, departments |
| `threshold_violations/{docId}` | Audit log of every auto-escalation event |

Firebase Auth holds the user accounts. Custom claims (`role`, `institute_id`) are written by the backend on role assignment and are embedded in the Firebase ID token.

### IPFS (Pinata)

All grievance content (title, description, category, attachments) is bundled as JSON and pinned to IPFS. The resulting CID is stored on-chain. This means:

- Large content stays off-chain (blockchain only stores a 46-character CID).
- Content is immutable and permanently retrievable via any IPFS gateway.
- Attachments (PDF, images, DOCX) are bundled into the same IPFS object.

---

## Grievance Submission Flow

```
Student submits form
        │
        ▼
1. Validate form fields (Pydantic)
        │
        ▼
2. Upload content bundle to Pinata (IPFS) ← synchronous, ~1–5 sec
        │  returns ipfs_cid
        ▼
3. Return HTTP 202 Accepted immediately ◄──── frontend receives response,
        │                                       shows success toast, redirects
        ▼
4. [BackgroundTask] Sign & send blockchain tx via relay wallet
        │  waits for tx receipt (~30–60 sec on Sepolia)
        ▼
5. [BackgroundTask] Write Firestore cache entry (grievanceId, status, metadata)
        │
        ▼
6. [BackgroundTask] Create student notification + enqueue confirmation email
        │
        ▼
7. [BackgroundTask] Notify committee members (notification + email)
```

The grievance appears in the student's dashboard and the committee dashboard once step 5 completes (typically within 1–2 minutes on Sepolia, seconds on Besu).

---

## Committee Voting Flow

```
Committee member opens grievance
        │
        ▼
committeePropose(id, proposedAction, remarksIpfsCid, memberId)
        │  stored on-chain; emits CommitteeVoteCast event
        ▼
Vote tally updated (yesCount / noCount / majorityNeeded)
        │
        ▼
If yesCount >= majorityNeeded:
    executeCommitteeAction(id)
        │  transitions grievance to next status
        │  emits GrievanceActionLogged event
        ▼
Firestore cache updated; committee and next-level notified
```

`majorityNeeded = committeeSize / 2 + 1`. Default `committeeSize` is 3 (requires 2 votes). Administrators can change it via Admin → Settings → Committee Size (calls `setCommitteeSize()` on-chain).

---

## Auto-Escalation (Threshold Watchdog)

```
APScheduler (every 30 minutes)
        │
        ▼
For each active grievance in Firestore:
    │
    ├─ Is thresholdDeadline < now? ──No──► skip
    │
    └─ Yes → verify on-chain status still matches
        │
        └─ Call adminAutoForward(grievanceId) on-chain
            │  relay wallet signs tx
            │  contract moves grievance to next level
            ▼
        Log threshold violation to Firestore
        Send alert email to admin
        Update Firestore cache
```

Each level has a configurable deadline (stored on-chain in `thresholdDuration[GrievanceStatus]`). The `setThreshold(level, newDuration)` contract function is called by the Admin Settings page via the backend.

---

## Authentication Flow

```
1. User enters email + password on /login
        │
        ▼
2. Firebase client SDK: signInWithEmailAndPassword()
        │  returns Firebase ID token (JWT, valid 1 hour)
        ▼
3. Frontend calls POST /api/v1/auth/verify-token
        │  body: { token: <firebase-id-token> }
        ▼
4. Backend: firebase_admin.auth.verify_id_token(token)
        │  extracts uid, email, role (custom claim), institute_id
        ▼
5. Backend fetches Firestore user profile (displayName, department, etc.)
        │
        ▼
6. Returns UserProfile JSON to frontend
        │
        ▼
7. Frontend stores role in cookie (read by Edge middleware for routing)
        │  TanStack Query caches UserProfile
        ▼
8. All subsequent API calls include Authorization: Bearer <token>
        │  backend verifies on every request
        ▼
9. Token refreshed automatically by Firebase SDK before expiry
```

---

## Role-Based Access Control

Access control is enforced at three independent layers:

| Layer | Mechanism |
|---|---|
| **Frontend routing** | Edge middleware reads `grievance_role` cookie; redirects wrong-role requests |
| **Backend API** | `require_role("committee")` dependency raises 403 if role doesn't match |
| **Smart contract** | OpenZeppelin `AccessControl` — relay wallet has specific roles granted; contract functions have `onlyRole` modifiers |

This means even if someone bypasses the frontend or constructs a raw API request, the backend and smart contract both independently enforce access.

---

## Smart Contract State Machine

```
                     ┌─────────────┐
              submit │             │
       ──────────────► AtCommittee │
                     └──────┬──────┘
                            │ committee vote: forward
                            ▼
                       ┌─────────┐
                       │  AtHoD  │◄─── committee vote: revert
                       └────┬────┘
                            │ hod: forward
                            ▼
                     ┌─────────────┐
                     │ AtPrincipal │◄─── hod: revert
                     └──────┬──────┘
                            │ principal: resolve OR
                            │ committee/hod: resolve
                            ▼
                    ┌────────────────┐
                    │AwaitingFeedback│
                    └───────┬────────┘
           satisfied │      │ unsatisfied
                     ▼      ▼
                 ┌──────┐  back to AtCommittee
                 │Closed│
                 └──────┘

   Debar path:
   AtCommittee ──committee vote: debar──► Debarred

   Auto-escalation (APScheduler):
   AtCommittee / AtHoD / AtPrincipal ──threshold exceeded──► next level
```

---

## Key Design Decisions

### Why relay wallet instead of user wallets?

Requiring each user to manage a browser wallet (MetaMask) adds significant friction — most institute students don't have one. The relay wallet pattern lets users interact via familiar email/password auth while still recording every action on-chain immutably. The trade-off is that the relay wallet is a single point of failure if the private key is compromised; mitigate by rotating it and revoking the old wallet's roles.

### Why Firestore as a cache layer?

Fetching grievance lists directly from the blockchain would require one RPC call per grievance (expensive and slow, especially on Sepolia). Firestore is written every time on-chain state changes and provides fast, filterable reads for dashboards. The blockchain remains the source of truth for all state and history.

### Why BackgroundTasks instead of Celery?

Celery requires Redis as a message broker — another managed service, added complexity, and added cost. FastAPI's built-in `BackgroundTasks` run in the same process after the HTTP response is sent. For the throughput of a single-institute deployment (tens of submissions per day), this is sufficient and eliminates the need for any external broker.

### Why APScheduler instead of Chainlink Automation?

Chainlink Automation is the more decentralized solution and is referenced in the original research. However, it requires a funded Chainlink subscription and is only available on public networks. APScheduler runs in-process on the Render backend, works on both Besu (private) and Sepolia, and has zero additional cost. For a private-institute deployment, this is the pragmatic choice.

### Why IPFS (Pinata) instead of on-chain storage?

Storing full grievance text and attachments on-chain would cost hundreds of dollars per submission on a public network and would bloat even a private Besu chain. IPFS stores content off-chain while the CID (content hash) is stored on-chain — providing content integrity guarantees without the cost. Pinata pins the content so it's always retrievable.

---

## Deployment Architecture

```
GitHub (source)
    │
    ├─ Push to main ──► GitHub Actions CI (pytest + tsc + hardhat test)
    │                ──► GitHub Actions CD (Render deploy hook + Vercel CLI)
    │
    └─ Manual trigger ──► deploy-contracts.yml (compile → test → Sepolia deploy → export ABIs)

Render.com (backend)
    - Docker container from backend/Dockerfile
    - Single web service (free tier: 512 MB RAM, sleeps after 15 min inactivity)
    - Auto-deploys from main branch or deploy hook

Vercel (frontend)
    - Next.js app from frontend/ directory
    - Auto-deploys from main branch
    - Edge middleware runs on Vercel Edge Network

Blockchain
    Option A: Private Hyperledger Besu (VPS, IBFT 2.0 consensus, zero gas cost)
    Option B: Ethereum Sepolia testnet via Alchemy (public, ~30-60s confirmation)
```
