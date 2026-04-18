# Blockchain-Based Grievance Redressal System — Implementation Plan

> Based on research by Ketan Ingale, Nishant Dalvi, Rakshitha Shettigar, Farhan Ansari & Ramkrushna Maheshwar  
> Modernized and extended for production deployment — April 2026

---

## Progress Tracker

_Last updated: April 2026 (post-deployment fixes applied)_

### Blockchain (Hardhat + Solidity)

| File | Status | Notes |
|---|---|---|
| `blockchain/hardhat.config.ts` | Done | localhost + Besu networks, gasPrice=0 |
| `blockchain/contracts/RoleManager.sol` | Done | OpenZeppelin AccessControl, 5 roles |
| `blockchain/contracts/GrievanceSystem.sol` | Done | Full lifecycle, committee voting, auto-forward, pause |
| `blockchain/contracts/GrievanceFactory.sol` | Done | Multi-institute factory pattern |
| `blockchain/scripts/deploy.ts` | Done | Deploys factory + institute, writes addresses to JSON |
| `blockchain/scripts/export-abis.ts` | Done | Copies ABIs to backend after compile |
| `blockchain/test/RoleManager.test.ts` | Done | 10 tests |
| `blockchain/test/GrievanceSystem.test.ts` | Done | 45 tests — full lifecycle coverage |

### Backend (FastAPI + Python)

| File | Status | Notes |
|---|---|---|
| `backend/app/config.py` | Done | pydantic-settings, all env vars typed |
| `backend/app/main.py` | Done | CORS, lifespan, error handlers, health endpoint |
| `backend/app/dependencies.py` | Done | `get_current_user`, `require_role()` factory |
| `backend/app/services/firebase.py` | Done | Auth, Firestore CRUD, notifications, email queue |
| `backend/app/services/blockchain.py` | Done | Web3.py relay wallet, all contract calls async |
| `backend/app/services/ipfs.py` | Done | Pinata upload/retrieve, file validation |
| `backend/app/services/email.py` | Done | SendGrid, 11 notification types, HTML templates |
| `backend/scheduler/jobs.py` | Done | threshold_watchdog (30min), email_queue_processor (1min) |
| `backend/app/routers/auth.py` | Done | register, verify-token, me, update-me |
| `backend/app/routers/grievances.py` | Done | submit, list, get, history, vote, feedback |
| `backend/app/routers/committee.py` | Done | propose, get-votes, execute |
| `backend/app/routers/hod.py` | Done | forward / revert / resolve |
| `backend/app/routers/principal.py` | Done | resolve / revert |
| `backend/app/routers/admin.py` | Done | users, roles, thresholds, departments, analytics |
| `backend/tests/test_auth.py` | Done | 8 tests, Firebase mocked |

### Frontend (Next.js 14 + TypeScript)

| File | Status | Notes |
|---|---|---|
| Project scaffold | Done | package.json, tsconfig, Tailwind, Next.js 14 |
| `lib/firebase.ts` | Done | Firebase client SDK singleton |
| `lib/api.ts` | Done | Axios with Bearer token interceptor |
| `lib/utils.ts` | Done | cn, timeAgo, countdown, statusColor, ipfsUrl |
| `types/index.ts` | Done | All shared TypeScript types |
| `hooks/useAuth.ts` | Done | Firebase auth state → UserProfile |
| `middleware.ts` | Done | Edge middleware, cookie-based role routing |
| `components/providers.tsx` | Done | QueryClientProvider + Sonner Toaster |
| `app/(auth)/layout.tsx` | Done | Centered auth card layout |
| `app/(auth)/login/page.tsx` | Done | React Hook Form + Zod, Firebase sign-in, cookie set |
| `app/(auth)/register/page.tsx` | Done | Calls backend /register, redirect to login |
| `components/ui/StatusBadge.tsx` | Done | Colour-coded status badge (shared) |
| `components/grievance/GrievanceCard.tsx` | Done | Card with votes, countdown, status (shared) |
| `app/student/layout.tsx` | Done | Sticky navbar, mobile drawer, sign-out |
| `app/student/dashboard/page.tsx` | Done | KPIs, filter tabs, TanStack Query list |
| `app/student/submit/page.tsx` | Done | Multipart form, drag-and-drop upload, anon toggle |
| `app/student/grievance/[id]/page.tsx` | Done | Stepper, countdown, IPFS content, votes, feedback, timeline |
| `components/layout/StaffLayout.tsx` | Done | Shared navbar layout for all staff roles |
| `app/committee/layout.tsx` | Done | Uses StaffLayout |
| `app/committee/dashboard/page.tsx` | Done | KPIs, grievance list, overdue count |
| `app/committee/grievance/[id]/page.tsx` | Done | IPFS content, tally bar, propose + execute voting |
| `components/grievance/ActionPanel.tsx` | Done | Shared single-actor action panel (HoD + Principal) |
| `components/grievance/StaffDetailShell.tsx` | Done | Shared detail layout (IPFS + timeline + action slot) |
| `app/hod/layout.tsx` | Done | Uses StaffLayout |
| `app/hod/dashboard/page.tsx` | Done | KPIs, overdue count, grievance list |
| `app/hod/grievance/[id]/page.tsx` | Done | Forward / Resolve / Revert via ActionPanel |
| `app/principal/layout.tsx` | Done | Uses StaffLayout |
| `app/principal/dashboard/page.tsx` | Done | KPIs, overdue count, grievance list |
| `app/principal/grievance/[id]/page.tsx` | Done | Resolve / Revert via ActionPanel |
| `app/admin/layout.tsx` | Done | Uses StaffLayout with Dashboard/Users/Settings nav |
| `app/admin/dashboard/page.tsx` | Done | KPI row, donut status chart, department bar chart |
| `app/admin/users/page.tsx` | Done | Searchable table, inline role editor, delete |
| `app/admin/settings/page.tsx` | Done | Threshold hours form (on-chain), department CRUD |

### Infrastructure / DevOps

| Item | Status | Notes |
|---|---|---|
| `docker-compose.yml` | Done | Backend service + optional Hardhat node comment |
| `.github/workflows/ci.yml` | Done | Backend pytest, frontend type-check + lint, Solidity compile + test |
| `.github/workflows/cd.yml` | Done | Render deploy hook + Vercel CLI deploy on push to main |
| `.github/workflows/deploy-contracts.yml` | Done | Compile → test → deploy to Sepolia → export ABIs (no local tooling needed) |
| `docs/deployment.md` | Done | Firebase, Pinata, SendGrid, Render, Vercel step-by-step |
| `docs/besu-network.md` | Done | IBFT 2.0 3-node setup, genesis.json, systemd service |
| `docs/architecture.md` | Done | Technical architecture: components, data flows, design decisions |

---

## Post-Deployment Fixes (April 2026)

The following issues were discovered and fixed during live Sepolia + Render + Vercel deployment:

| Issue | Root Cause | Fix Applied |
|---|---|---|
| Sign-in button reset immediately after login | `signInWithEmailAndPassword` returns before `verify-token` completes; loading state dropped too early | Added `isBusy = submitting \|\| (loading && !authError)` so spinner persists through token verification |
| `submitGrievance` ABI argument mismatch | Backend added `studentId bytes32` param; `GrievanceSystem.json` in repo still had old 5-param ABI | Manually updated all affected ABI entries (`submitGrievance`, `castVote`, `submitFeedback`, `committeePropose`) |
| CORS crash on startup (`ValueError: allow_credentials=True` + wildcard) | Starlette rejects `allow_origins=["*"]` combined with `allow_credentials=True` | Added wildcard check in `main.py`; set `allow_credentials=False` when origins is `*` |
| Committee / HoD / Principal dashboards returned 500 | Firestore `order_by()` combined with multiple `where()` filters requires composite indexes that were not created | Removed `order_by` from all Firestore queries; sort in Python post-query |
| `INSTITUTE_ADMIN_ADDRESS` wrong on first Sepolia deploy | Deploy workflow set admin to deployer wallet; relay wallet (actual `msg.sender`) had no ADMIN_ROLE → all txs reverted | Workflow now derives relay wallet address from `RELAY_WALLET_PRIVATE_KEY` and passes it as `INSTITUTE_ADMIN_ADDRESS` |
| "Network error" on grievance submit (grievance still submitted) | Render drops HTTP connection at 30 seconds; Sepolia tx confirmation takes 30–60 seconds | IPFS upload stays synchronous; blockchain tx moved to FastAPI `BackgroundTask`; endpoint returns 202 immediately |

---

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [Smart Contract Design](#4-smart-contract-design)
5. [Backend Design](#5-backend-design)
6. [Frontend Design](#6-frontend-design)
7. [Database Design](#7-database-design)
8. [Dynamic Time Threshold Engine](#8-dynamic-time-threshold-engine)
9. [Development Phases](#9-development-phases)
10. [Folder Structure](#10-folder-structure)
11. [Deployment Strategy](#11-deployment-strategy)
12. [Security Considerations](#12-security-considerations)
13. [Improvements Over Original Research](#13-improvements-over-original-research)

---

## 1. Executive Summary

The original research proposed a blockchain-based grievance redressal system for institutes, using Hyperledger Fabric with a 3-level hierarchy (Grievance Committee → HoD → Principal), dynamic time thresholds, and immutable audit trails.

This plan converts that research into a **production-ready, deployable system** with a modern tech stack. Key decisions:

- **Solidity on Polygon PoS** replaces Hyperledger Fabric — same permissioned logic, but Solidity is widely supported, easier to develop, and Polygon keeps gas fees near-zero.
- **FastAPI (Python)** for the backend — matches the team's Python preference.
- **Next.js (React)** for the frontend — Python frontend tools like Streamlit are prototyping tools, not production-grade. Next.js is the industry standard, is straightforward to learn, and produces a far superior user experience.
- **Firebase Firestore** replaces Airtable — Airtable is a no-code spreadsheet tool and is not suitable as an application database. Firebase provides real-time sync, built-in auth, and scales automatically. Airtable is dropped entirely.
- **IPFS via Pinata** for decentralized document storage — keeps large files off-chain while anchoring their hashes on-chain.
- **Chainlink Automation** handles the dynamic time threshold on-chain — this is more blockchain-native than a pure Python scheduler.

---

## 2. Tech Stack

### 2.1 Blockchain Layer

| Tool | Purpose | Why |
|---|---|---|
| **Solidity ^0.8.20** | Smart contract language | Team preference, widely documented |
| **Hardhat** | Compile, test, deploy contracts | Industry standard, great TypeScript support |
| **OpenZeppelin Contracts** | Access control, pausable, reentrancy guards | Audited, battle-tested security primitives |
| **Polygon PoS (Mumbai testnet / Mainnet)** | EVM-compatible chain | ~$0.001 gas per tx vs Ethereum's $5–50. EVM-compatible so all Solidity works as-is |
| **Chainlink Automation (Keepers)** | On-chain time threshold triggering | Trustless, decentralized automation — no central cron job |
| **IPFS + Pinata** | Decentralized file storage | Grievance documents stored off-chain, hash stored on-chain |

> **Why not Hyperledger Fabric?**  
> Fabric is a great enterprise tool but requires Go/Java chaincode, complex CA setup, and is extremely hard to deploy. Since the team knows Python and wants Solidity, the Ethereum/Polygon path is the right call. A private Polygon network can replicate the "permissioned" aspect of Fabric.

---

### 2.2 Backend Layer

| Tool | Purpose | Why |
|---|---|---|
| **Python 3.11+** | Core backend language | Team preference |
| **FastAPI** | REST API framework | Async, auto-generates OpenAPI docs, fastest Python framework |
| **Web3.py** | Ethereum/Polygon interaction | Official Python Ethereum library |
| **APScheduler** | In-process background scheduler | Runs threshold watchdog + email dispatch inside FastAPI — no external broker needed |
| **Firebase Admin SDK (Python)** | Firestore + Auth backend access | Manages user records and real-time DB |
| **Pinata SDK / requests** | Upload files to IPFS | Simple REST API |
| **SendGrid** | Transactional email notifications | Reliable, free tier sufficient for institute scale |
| **Pydantic v2** | Data validation and serialization | Built into FastAPI |
| **pytest** | Unit and integration tests | Standard Python testing |

---

### 2.3 Frontend Layer

| Tool | Purpose | Why |
|---|---|---|
| **Next.js 14 (App Router)** | React framework | Server-side rendering, file-based routing, easy deployment |
| **TypeScript** | Type safety | Catches bugs at compile time, essential for a multi-role app |
| **Tailwind CSS** | Styling | Rapid UI development, no CSS files to manage |
| **shadcn/ui** | Component library | Accessible, unstyled-by-default components built on Radix |
| **ethers.js v6** | Wallet + contract interaction in browser | Pairs with MetaMask |
| **MetaMask SDK** | Wallet authentication (optional) | Lets authority users sign transactions from browser |
| **Firebase JS SDK** | Real-time Firestore listener, Auth | Live grievance status updates without polling |
| **React Query (TanStack)** | Data fetching, caching | Handles loading/error states cleanly |
| **Recharts** | Analytics charts | Lightweight, React-native charting |
| **React Hook Form + Zod** | Form handling and validation | Type-safe form submission |

> **Why not Python for frontend?**  
> Streamlit and Gradio are excellent for data science demos, not for multi-role, real-time production dashboards. They have no routing, poor mobile support, and no fine-grained component control. Next.js takes 1–2 days to learn for a Python developer and produces a vastly superior result.

---

### 2.4 Database Layer

| Store | Tool | What goes here |
|---|---|---|
| **Off-chain relational/doc store** | Firebase Firestore | User profiles, roles, institute config, notifications, grievance metadata cache |
| **Auth** | Firebase Authentication | Email/password + Google SSO, institute email domain validation |
| **File storage** | IPFS via Pinata | Grievance description docs, supporting attachments, resolution documents |
| **On-chain state** | Solidity contract storage (Polygon) | Grievance status, action history, timestamps, hashes — the immutable audit trail |
| **In-process cache** | Python dict + Firebase | Simple TTL cache in FastAPI process; no external cache service needed at personal project scale |

> **Why not Airtable?**  
> Airtable is a no-code spreadsheet/CRM tool. It has rate-limited APIs, no real-time listeners, no proper access control for application use, and is not suitable as a production database for a multi-user system. Firebase Firestore is the right call — it is free up to 1GB/50k reads per day, has real-time sync, and integrates directly with Firebase Auth.

---

## 3. System Architecture

### 3.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USERS (Browser)                          │
│   Student | Committee Member | HoD | Principal | Admin          │
└────────────────────┬────────────────────────────────────────────┘
                     │  HTTPS
┌────────────────────▼────────────────────────────────────────────┐
│                    NEXT.JS FRONTEND                             │
│   Student Dashboard | Authority Dashboards | Admin Panel        │
│   Firebase Auth SDK | ethers.js | Real-time Firestore listener  │
└──────────┬──────────────────────────────────┬───────────────────┘
           │ REST API calls                   │ Firebase SDK (direct)
┌──────────▼──────────┐            ┌──────────▼───────────────────┐
│   FASTAPI BACKEND   │            │     FIREBASE FIRESTORE       │
│   Python 3.11       │◄──────────►│     (off-chain metadata,     │
│   Web3.py           │            │      user profiles, cache)   │
│   APScheduler       │            └──────────────────────────────┘
│   SendGrid          │
└──────────┬──────────┘
           │  Web3.py RPC calls
┌──────────▼──────────────────────────────────────────────────────┐
│                  POLYGON PoS NETWORK                            │
│                                                                 │
│   ┌─────────────────┐    ┌──────────────────┐                  │
│   │ GrievanceFactory│    │  GrievanceSystem  │                  │
│   │   (contract)    │───►│    (contract)     │                  │
│   └─────────────────┘    └────────┬─────────┘                  │
│                                   │                             │
│   ┌───────────────────────────────▼──────────────────────┐     │
│   │         Chainlink Automation (Keepers)               │     │
│   │   Checks time thresholds, triggers auto-forward      │     │
│   └──────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
           │  Pinata API
┌──────────▼──────────┐
│   IPFS (via Pinata) │
│   Documents, images │
│   attached to griev.│
└─────────────────────┘
```

---

### 3.2 Roles and Permissions

| Role | Auth Method | Capabilities |
|---|---|---|
| **Student** | Firebase email/password (institute email) | Submit grievance, track status, vote, give feedback, anonymous option |
| **Committee Member** | Firebase email/password + role claim | View assigned grievances, vote to resolve/forward/debar, add remarks |
| **Head of Department (HoD)** | Firebase email/password + role claim | View escalated grievances, resolve/forward/revert, add remarks |
| **Principal** | Firebase email/password + role claim | View top-level grievances, resolve/revert, final authority |
| **Institute Admin** | Firebase email/password + admin claim | Manage users, roles, departments, thresholds, analytics |

Role claims are set in Firebase custom claims by the admin and are verified server-side in the FastAPI middleware on every request.

---

### 3.3 Grievance Lifecycle State Machine

```
                    ┌─────────┐
                    │ STUDENT │
                    └────┬────┘
                         │ Submit()
                         ▼
                  ┌─────────────┐
            ┌────►│  COMMITTEE  │◄──────────────────────────┐
            │     └──────┬──────┘                           │
            │     Debar()│Forward() / Threshold()           │
            │            ▼                                  │
            │     ┌─────────────┐                          │
            │     │     HOD     │◄─────────────────┐       │
            │     └──────┬──────┘                  │       │
            │     Revert()│Forward() / Threshold()  │       │
            │            ▼                          │       │
            │     ┌─────────────┐                  │       │
            │     │  PRINCIPAL  │                  │       │
            │     └──────┬──────┘                  │       │
            │     Revert()│Resolve()                │       │
            │            ▼                          │       │
            │     ┌─────────────┐  Not Satisfied   │       │
            │     │  FEEDBACK   │──────────────────┘       │
            │     └──────┬──────┘                          │
            │  Satisfied │                                  │
            │            ▼                                  │
            │     ┌─────────────┐                          │
            │     │   CLOSED    │                          │
            │     └─────────────┘                          │
            │                                              │
            └──────────────────── Debar ──────────────────►│
                                                    DEBARRED│
                                                     (final)│
```

**States:** `SUBMITTED` → `AT_COMMITTEE` → `AT_HOD` → `AT_PRINCIPAL` → `AWAITING_FEEDBACK` → `CLOSED` | `DEBARRED`

**Auto-forward (Threshold):** If a grievance sits at any level past its deadline without action, Chainlink Automation calls `autoForward()` on the contract, escalating it to the next level and logging the inaction permanently.

---

### 3.4 Consensus for Committee Decisions

Since the Grievance Committee has multiple members, any action (Forward, Debar, Resolve) requires a **majority vote (>50%)** from active committee members of the relevant department.

- Each member casts a vote on-chain.
- The smart contract tallies votes.
- When majority is reached, the action executes automatically.
- All votes are permanently recorded — no member can claim they didn't vote.

---

## 4. Smart Contract Design

### 4.1 Contract Overview

Three contracts are deployed, following a factory pattern so multiple institutes can share the same codebase:

```
contracts/
├── GrievanceFactory.sol      # Deploys one GrievanceSystem per institute
├── GrievanceSystem.sol       # Core logic — the main contract
├── RoleManager.sol           # On-chain role assignments (uses OpenZeppelin AccessControl)
└── interfaces/
    └── IGrievanceSystem.sol  # Interface for Chainlink Automation compatibility
```

---

### 4.2 GrievanceSystem.sol — Data Structures

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Enums
enum GrievanceStatus {
    Submitted,       // 0 - just created, not yet at committee
    AtCommittee,     // 1
    AtHoD,           // 2
    AtPrincipal,     // 3
    AwaitingFeedback,// 4 - resolved, waiting for student satisfaction
    Closed,          // 5 - satisfied and closed
    Debarred         // 6 - rejected by committee
}

enum ActionType {
    Submit,
    Forward,
    Revert,
    Resolve,
    Debar,
    AutoForward,   // triggered by Chainlink Automation
    FeedbackSatisfied,
    FeedbackUnsatisfied
}

// Main grievance record
struct Grievance {
    uint256 id;
    bytes32 studentIdentifier; // keccak256(studentUID) — anonymous by default on-chain
    bool    isAnonymous;       // if true, frontend shows "Anonymous User"
    string  category;
    string  subCategory;
    string  department;        // which HoD branch this belongs to
    string  ipfsHash;          // IPFS CID of title + description + attachments JSON
    GrievanceStatus status;
    uint256 createdAt;
    uint256 updatedAt;
    uint256 thresholdDeadline; // unix timestamp — auto-forward fires after this
    uint256 upvotes;
    uint256 downvotes;
    bool    needsChainlinkCheck; // flag for Chainlink Automation upkeep
}

// Every action taken on a grievance creates one of these — the audit trail
struct GrievanceAction {
    uint256 grievanceId;
    address actor;
    ActionType action;
    string  remarksIpfsHash; // IPFS CID of the remark text/document
    uint256 timestamp;
    GrievanceStatus fromStatus;
    GrievanceStatus toStatus;
}

// Committee vote tracking
struct CommitteeVote {
    mapping(address => bool) hasVoted;
    mapping(address => bool) inFavor;
    uint256 yesCount;
    uint256 noCount;
    ActionType proposedAction;
    bool      executed;
}
```

---

### 4.3 GrievanceSystem.sol — Key Functions

```solidity
// ---- Student functions ----

// Submit a new grievance; returns the grievance ID
function submitGrievance(
    string calldata category,
    string calldata subCategory,
    string calldata department,
    string calldata ipfsHash,
    bool isAnonymous
) external returns (uint256 grievanceId);

// Student upvotes/downvotes a grievance (one per student per grievance)
function castVote(uint256 grievanceId, bool isUpvote) external;

// Student submits satisfaction feedback after a Resolve action
function submitFeedback(uint256 grievanceId, bool isSatisfied, string calldata remarksIpfsHash) external;


// ---- Committee functions (require COMMITTEE_ROLE) ----

// A committee member proposes an action — starts or adds to a vote
function committeePropose(uint256 grievanceId, ActionType action, string calldata remarksIpfsHash) external;

// Once majority reached, anyone can call this to execute the pending action
function executeCommitteeAction(uint256 grievanceId) external;


// ---- HoD functions (require HOD_ROLE) ----

function hodAction(
    uint256 grievanceId,
    ActionType action,   // Forward | Revert | Resolve
    string calldata remarksIpfsHash
) external;


// ---- Principal functions (require PRINCIPAL_ROLE) ----

function principalAction(
    uint256 grievanceId,
    ActionType action,   // Resolve | Revert
    string calldata remarksIpfsHash
) external;


// ---- Chainlink Automation (AutoForward) ----

// Called by Chainlink Keeper — checks all open grievances past deadline
function checkUpkeep(bytes calldata) external view returns (bool upkeepNeeded, bytes memory performData);

// Chainlink calls this to auto-forward overdue grievances
function performUpkeep(bytes calldata performData) external;


// ---- View functions ----

function getGrievance(uint256 id) external view returns (Grievance memory);
function getActionHistory(uint256 grievanceId) external view returns (GrievanceAction[] memory);
function getGrievancesByDepartment(string calldata dept) external view returns (uint256[] memory);
function getGrievancesByStatus(GrievanceStatus status) external view returns (uint256[] memory);
```

---

### 4.4 RoleManager.sol

Uses OpenZeppelin's `AccessControl` with the following roles:

```solidity
bytes32 public constant STUDENT_ROLE      = keccak256("STUDENT_ROLE");
bytes32 public constant COMMITTEE_ROLE    = keccak256("COMMITTEE_ROLE");
bytes32 public constant HOD_ROLE          = keccak256("HOD_ROLE");
bytes32 public constant PRINCIPAL_ROLE    = keccak256("PRINCIPAL_ROLE");
bytes32 public constant ADMIN_ROLE        = keccak256("ADMIN_ROLE");
```

The `ADMIN_ROLE` holder (institute admin) grants/revokes roles. Role assignments on-chain mirror what Firebase custom claims store off-chain — both must agree for an action to succeed (defense in depth).

---

### 4.5 Dynamic Threshold Configuration

```solidity
// Threshold durations stored per level (configurable by admin)
mapping(GrievanceStatus => uint256) public thresholdDuration;

// Default values (admin can update these)
// AtCommittee  → 7 days
// AtHoD        → 5 days
// AtPrincipal  → 3 days
```

When a grievance moves to a new level, `thresholdDeadline = block.timestamp + thresholdDuration[newStatus]` is set. Chainlink Automation fires `performUpkeep` when `block.timestamp > thresholdDeadline` for any open grievance.

---

### 4.6 Hardhat Project Setup

```
blockchain/
├── contracts/
│   ├── GrievanceFactory.sol
│   ├── GrievanceSystem.sol
│   ├── RoleManager.sol
│   └── interfaces/
│       └── IGrievanceSystem.sol
├── scripts/
│   ├── deploy.ts        # Hardhat deploy script
│   └── seed.ts          # Seeds test data on local network
├── test/
│   ├── GrievanceSystem.test.ts
│   ├── RoleManager.test.ts
│   └── Threshold.test.ts
├── hardhat.config.ts
└── package.json
```

**hardhat.config.ts networks:**
- `localhost` — Hardhat local node (development)
- `mumbai` — Polygon Mumbai testnet
- `polygon` — Polygon PoS mainnet

---

## 5. Backend Design

### 5.1 FastAPI Project Structure

```
backend/
├── app/
│   ├── main.py                  # FastAPI app init, CORS, middleware
│   ├── config.py                # Env vars (pydantic-settings)
│   ├── dependencies.py          # Auth middleware, DB session, Web3 instance
│   │
│   ├── routers/
│   │   ├── auth.py              # Login, signup, token refresh
│   │   ├── grievances.py        # Submit, list, get, vote, feedback
│   │   ├── committee.py         # Committee propose, vote, execute
│   │   ├── hod.py               # HoD actions
│   │   ├── principal.py         # Principal actions
│   │   ├── admin.py             # User management, role assignment, thresholds
│   │   ├── analytics.py         # Statistics endpoints
│   │   └── notifications.py     # Notification preferences
│   │
│   ├── services/
│   │   ├── blockchain.py        # Web3.py wrapper — all contract interactions
│   │   ├── firebase.py          # Firestore + Auth Admin SDK wrapper
│   │   ├── ipfs.py              # Pinata upload/retrieve wrapper
│   │   ├── email.py             # SendGrid email service
│   │   └── threshold.py         # APScheduler job — threshold watchdog
│   │
│   ├── models/
│   │   ├── grievance.py         # Pydantic models for request/response
│   │   ├── user.py
│   │   └── analytics.py
│   │
│   └── utils/
│       ├── crypto.py            # keccak256 student ID hashing
│       └── pagination.py
│
├── scheduler/
│   └── jobs.py                  # APScheduler jobs — threshold watchdog, email dispatch
│
├── tests/
│   ├── test_grievances.py
│   ├── test_auth.py
│   └── test_blockchain_service.py
│
├── Dockerfile
├── requirements.txt
└── .env.example
```

---

### 5.2 Key API Endpoints

All endpoints are prefixed with `/api/v1`. Auth header: `Authorization: Bearer <firebase-id-token>`

#### Authentication
```
POST   /api/v1/auth/register          # Student self-registration
POST   /api/v1/auth/verify-token      # Validate Firebase token, return user profile
POST   /api/v1/auth/refresh           # Refresh session
```

#### Grievances
```
POST   /api/v1/grievances/            # Submit a new grievance
GET    /api/v1/grievances/            # List grievances (filtered by role)
GET    /api/v1/grievances/{id}        # Get single grievance + full action history
GET    /api/v1/grievances/{id}/history # Get blockchain action log for a grievance
POST   /api/v1/grievances/{id}/vote   # Upvote or downvote
POST   /api/v1/grievances/{id}/feedback # Submit satisfaction feedback
```

#### Committee
```
POST   /api/v1/committee/{id}/propose  # Propose an action (starts/adds to vote)
GET    /api/v1/committee/{id}/votes    # Get current vote tally
POST   /api/v1/committee/{id}/execute  # Execute once majority reached
```

#### HoD
```
POST   /api/v1/hod/{id}/action        # forward | revert | resolve
```

#### Principal
```
POST   /api/v1/principal/{id}/action  # resolve | revert
```

#### Admin
```
GET    /api/v1/admin/users            # List all users
POST   /api/v1/admin/users/{uid}/role # Assign/revoke role
PUT    /api/v1/admin/thresholds       # Update level thresholds
GET    /api/v1/admin/departments      # List departments
POST   /api/v1/admin/departments      # Add department
```

#### Analytics
```
GET    /api/v1/analytics/overview     # Total, resolved, pending, debarred counts
GET    /api/v1/analytics/by-dept      # Per department breakdown
GET    /api/v1/analytics/timeline     # Grievances over time (chart data)
GET    /api/v1/analytics/resolution-time # Average resolution time per level
```

---

### 5.3 Blockchain Service (services/blockchain.py)

This is the bridge between FastAPI and the smart contracts. All contract interactions are async-wrapped.

```python
class BlockchainService:
    def __init__(self, w3: Web3, contract_address: str, abi: list):
        self.contract = w3.eth.contract(address=contract_address, abi=abi)
        self.w3 = w3

    async def submit_grievance(
        self,
        category: str,
        sub_category: str,
        department: str,
        ipfs_hash: str,
        is_anonymous: bool,
        sender_private_key: str   # backend signs with a relay wallet
    ) -> dict:
        # Build tx, sign, send, wait for receipt
        # Return tx_hash + grievance_id from event log
        ...

    async def get_grievance(self, grievance_id: int) -> dict:
        # Read from contract (no gas needed)
        ...

    async def get_action_history(self, grievance_id: int) -> list[dict]:
        # Fetch all GrievanceActionLogged events for this ID
        ...

    async def cast_committee_vote(self, grievance_id: int, action: str,
                                   remarks_ipfs: str, member_key: str) -> dict: ...

    async def hod_action(self, grievance_id: int, action: str,
                          remarks_ipfs: str, hod_key: str) -> dict: ...

    async def principal_action(self, grievance_id: int, action: str,
                                remarks_ipfs: str, principal_key: str) -> dict: ...
```

**Relay wallet pattern:** To avoid exposing user private keys to the backend, the backend uses a **gasless relay wallet** (funded with MATIC) that submits transactions on behalf of users. The user's identity is verified via Firebase token before the relay wallet signs the transaction. This is a common pattern called a "meta-transaction relay."

---

### 5.4 IPFS Service (services/ipfs.py)

```python
class IPFSService:
    async def upload_grievance_content(
        self,
        title: str,
        description: str,
        files: list[UploadFile]
    ) -> str:
        # Bundle metadata + files into JSON, upload to Pinata
        # Return IPFS CID (content identifier)
        ...

    async def retrieve(self, cid: str) -> dict:
        # Fetch from Pinata gateway
        ...
```

File size limits: 10MB per attachment, max 5 attachments per grievance. Supported types: PDF, JPG, PNG, DOCX.

---

### 5.5 APScheduler Jobs (Threshold Backup)

APScheduler runs inside the FastAPI process — no Redis, no separate worker, no extra service to host. Two background jobs are registered at app startup.

```python
# scheduler/jobs.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job("interval", minutes=30)
async def threshold_watchdog():
    """
    Runs every 30 mins. Fetches all active grievances from Firestore cache,
    checks thresholdDeadline vs now. If overdue and not already forwarded,
    triggers auto-forward via the relay wallet and sends admin alert email.
    """
    ...

@scheduler.scheduled_job("interval", minutes=1)
async def process_email_queue():
    """
    Checks a Firestore 'email_queue' collection for pending emails,
    sends via SendGrid, marks as sent. Simple and free — no Redis queue needed.
    """
    ...
```

```python
# app/main.py  — start scheduler with the app
@app.on_event("startup")
async def startup():
    scheduler.start()

@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()
```

For a personal project this is completely sufficient. APScheduler's `AsyncIOScheduler` runs in the same event loop as FastAPI and handles both jobs without any external dependency.

---

## 6. Frontend Design

### 6.1 Next.js Project Structure

```
frontend/
├── app/
│   ├── layout.tsx                    # Root layout, providers
│   ├── page.tsx                      # Landing page (login/signup CTA)
│   │
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   │
│   ├── student/
│   │   ├── layout.tsx                # Student shell (sidebar, nav)
│   │   ├── dashboard/page.tsx        # Active + past grievances
│   │   ├── submit/page.tsx           # Submit new grievance form
│   │   └── grievance/[id]/page.tsx   # Single grievance tracker
│   │
│   ├── committee/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx        # All committee grievances, vote status
│   │   └── grievance/[id]/page.tsx   # Voting panel
│   │
│   ├── hod/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   └── grievance/[id]/page.tsx   # Action panel (forward/revert/resolve)
│   │
│   ├── principal/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   └── grievance/[id]/page.tsx
│   │
│   └── admin/
│       ├── layout.tsx
│       ├── dashboard/page.tsx        # Analytics overview
│       ├── users/page.tsx            # User + role management
│       └── settings/page.tsx         # Threshold config, departments
│
├── components/
│   ├── ui/                           # shadcn/ui base components
│   ├── grievance/
│   │   ├── GrievanceCard.tsx
│   │   ├── GrievanceForm.tsx
│   │   ├── StatusTracker.tsx         # Visual pipeline: Student→Committee→HoD→Principal
│   │   ├── ActionHistory.tsx         # On-chain audit trail rendered as a timeline
│   │   ├── VotePanel.tsx             # Committee voting interface
│   │   ├── ActionPanel.tsx           # HoD/Principal action form
│   │   └── FeedbackForm.tsx
│   ├── analytics/
│   │   ├── OverviewCards.tsx
│   │   ├── GrievanceChart.tsx        # Recharts line/bar chart
│   │   └── DeptBreakdown.tsx
│   └── layout/
│       ├── Sidebar.tsx
│       ├── Navbar.tsx
│       └── NotificationBell.tsx
│
├── lib/
│   ├── firebase.ts                   # Firebase client init
│   ├── api.ts                        # Axios instance pointing to FastAPI
│   ├── contract.ts                   # ethers.js contract instance
│   └── utils.ts
│
├── hooks/
│   ├── useGrievance.ts               # React Query hooks
│   ├── useAuth.ts                    # Firebase auth state
│   └── useRealtime.ts                # Firestore onSnapshot listener
│
├── types/
│   └── index.ts                      # Shared TypeScript types
│
└── public/
    └── (static assets)
```

---

### 6.2 Key Screens

#### Student — Submit Grievance
- Category dropdown (Academic, Infrastructure, Administrative, Other)
- Sub-category (dynamic based on category)
- Department selector (routes grievance to correct HoD)
- Description (rich text)
- File upload (drag-and-drop, max 5 files, 10MB each)
- Anonymous toggle
- Preview before submission
- Confirmation with blockchain TX hash on success

#### Student — Grievance Tracker
- Visual step indicator: `Submitted → Committee → HoD → Principal → Resolved`
- Current level highlighted
- Countdown timer showing time remaining before auto-forward
- Full action history timeline (sourced from on-chain events):
  - Who acted, what action, when, remarks
  - Authority names shown for non-anonymous grievances
- Upvote/Downvote button (visible to all students of that institute)
- Feedback form (appears once grievance is resolved)

#### Committee Dashboard
- List of active grievances at committee stage
- Live vote tally per grievance
- Filter by department, category, date
- "Propose Action" → opens modal to cast vote with remarks

#### HoD / Principal Dashboard
- List of grievances at their level
- Urgency indicator (days remaining before threshold, red if overdue)
- Action panel: dropdown for action type + remarks text area
- "View full history" links to on-chain audit

#### Admin — Analytics
- KPI cards: Total submitted, Resolved, Pending, Debarred, Avg resolution time
- Line chart: grievances over time (last 30/60/90 days)
- Bar chart: by department
- Heat map: resolution time by level
- Export to CSV button

---

### 6.3 Real-Time Updates

Firebase Firestore listeners on the `grievances` collection push live updates to the frontend without polling. When the backend writes a Firestore update after a blockchain state change, all connected clients with access to that grievance document receive the update instantly. The `StatusTracker` component re-renders automatically.

---

### 6.4 Authentication Flow

```
1. User visits /login
2. Firebase Auth (email/password or Google)
3. Firebase returns ID token
4. Frontend sends token to POST /api/v1/auth/verify-token
5. Backend verifies token with Firebase Admin SDK
6. Backend reads user's custom claims (role) from Firebase
7. Backend returns user profile + role
8. Frontend stores role in React context
9. Next.js middleware redirects to role-specific dashboard (/student, /hod, etc.)
```

Institute email domain validation: During registration, the backend checks that the email domain matches the institute's configured domain (e.g. `@mitwpu.edu.in`). If not, registration is rejected.

---

## 7. Database Design

### 7.1 What Goes Where

| Data | Store | Reason |
|---|---|---|
| Grievance state, actions, votes | Solidity contract (on-chain) | Immutable, auditable, tamper-proof |
| User profiles, roles | Firebase Firestore + Auth custom claims | Off-chain, mutable, fast reads |
| Institute config, departments | Firebase Firestore | Admin-editable, no gas cost |
| Notifications, read status | Firebase Firestore | Real-time, ephemeral |
| Grievance text, documents | IPFS via Pinata | Decentralized, content-addressed |
| Grievance metadata cache | Firebase Firestore | Fast list/filter without RPC calls |
| Email queue | Firebase Firestore `email_queue` collection | APScheduler polls this — no Redis needed |

---

### 7.2 Firebase Firestore Collections

```
firestore/
│
├── institutes/{instituteId}
│   ├── name: string
│   ├── emailDomain: string          # e.g. "mitwpu.edu.in"
│   ├── contractAddress: string      # deployed GrievanceSystem contract address
│   ├── thresholds: map
│   │   ├── committee_days: number   # 7
│   │   ├── hod_days: number         # 5
│   │   └── principal_days: number   # 3
│   └── departments: array<string>
│
├── users/{uid}
│   ├── displayName: string
│   ├── email: string
│   ├── role: string                 # student | committee | hod | principal | admin
│   ├── department: string           # for hod/committee — which dept they manage
│   ├── instituteId: string
│   ├── walletAddress: string        # optional MetaMask address
│   └── createdAt: timestamp
│
├── grievances/{grievanceId}         # CACHE — mirrors on-chain state for fast queries
│   ├── onChainId: number
│   ├── title: string                # stored here (not on-chain, for search)
│   ├── category: string
│   ├── subCategory: string
│   ├── department: string
│   ├── status: string
│   ├── isAnonymous: boolean
│   ├── studentUid: string           # null if anonymous
│   ├── ipfsCid: string
│   ├── upvotes: number
│   ├── downvotes: number
│   ├── thresholdDeadline: timestamp
│   ├── createdAt: timestamp
│   ├── updatedAt: timestamp
│   └── instituteId: string
│
├── notifications/{uid}/items/{notifId}
│   ├── grievanceId: string
│   ├── message: string
│   ├── type: string                 # action_taken | threshold_warning | feedback_requested
│   ├── isRead: boolean
│   └── createdAt: timestamp
│
└── votes/{grievanceId}/committee/{memberUid}
    ├── action: string               # forward | resolve | debar
    ├── inFavor: boolean
    └── timestamp: timestamp
```

---

### 7.3 Firestore Security Rules (Summary)

```
- institutes: readable by members of that institute; writable by admin only
- users/{uid}: readable by the user themselves and admins; writable by admin
- grievances: readable by all users of that institute; writable by backend only (via Admin SDK)
- notifications/{uid}/*: readable and writable only by that uid
- votes/{grievanceId}/committee/{uid}: readable by committee of that dept; writable by that uid only
```

The backend (FastAPI with Firebase Admin SDK) bypasses security rules entirely — it has full access. Security rules only apply to direct client SDK calls.

---

### 7.4 Caching (No Redis)

At personal project scale, a simple in-process Python dict with TTL is sufficient for caching. FastAPI's lifespan state holds the cache dict.

```python
# Simple in-process TTL cache — no Redis needed
cache: dict[str, tuple[any, float]] = {}   # key → (value, expires_at)

def cache_get(key: str): ...
def cache_set(key: str, value: any, ttl_seconds: int): ...
```

Cached items: grievance list responses (60s TTL), analytics aggregations (300s TTL). If traffic grows and this becomes a bottleneck, Upstash Redis (free tier, 10k commands/day) can be dropped in as a swap with one config line change.

---

## 8. Dynamic Time Threshold Engine

This is one of the most important features from the original research — grievances auto-escalate if ignored. The implementation uses two layers to guarantee reliability.

### 8.1 Layer 1 — Chainlink Automation (On-Chain, Primary)

Chainlink Automation (formerly Chainlink Keepers) is a decentralized network of nodes that call smart contract functions on a schedule or condition. This is fully trustless.

**How it works:**
1. `GrievanceSystem.sol` implements `AutomationCompatibleInterface`
2. `checkUpkeep()` is called off-chain by Chainlink nodes every block
3. It iterates active grievances and checks `block.timestamp > thresholdDeadline`
4. If any are overdue, it returns `upkeepNeeded = true` and encodes their IDs in `performData`
5. Chainlink calls `performUpkeep(performData)` on-chain
6. The contract auto-forwards each overdue grievance and logs the action
7. Auto-forward is indistinguishable from a manual forward in the audit log — except `ActionType.AutoForward` is recorded

**Gas optimization for checkUpkeep:**
- Maintain a `uint256[] activeGrievanceIds` array in storage
- Remove IDs when grievances close or debar
- Cap iteration at 50 per upkeep call to stay within gas limits
- Multiple upkeep rounds handle backlogs

**Chainlink registration:**
- Register the contract at `automation.chain.link`
- Fund with LINK tokens (small recurring cost)
- Set check interval to every 1 hour

---

### 8.2 Layer 2 — APScheduler (Off-Chain, Primary for Besu)

Since we are using a private Besu network (not a public chain), Chainlink Automation is not available. APScheduler running inside FastAPI is the sole threshold mechanism. It runs every 30 minutes, reads from Firestore (no RPC cost for the check), and triggers the relay wallet to call `autoForward()` on the contract when a deadline is missed.

```python
# scheduler/jobs.py
@scheduler.scheduled_job("interval", minutes=30)
async def threshold_watchdog():
    now = datetime.utcnow()
    overdue = (
        firestore_client.collection("grievances")
        .where("status", "in", ["AtCommittee", "AtHoD", "AtPrincipal"])
        .where("thresholdDeadline", "<", now)
        .stream()
    )
    for doc in overdue:
        g = doc.to_dict()
        # Verify on-chain status hasn't already moved
        on_chain = await blockchain_service.get_grievance(g["onChainId"])
        if on_chain["status"] == g["status"]:
            await blockchain_service.admin_auto_forward(g["onChainId"])
            await email_service.send_admin_alert(g)
            # Log to Firestore for audit
            firestore_client.collection("threshold_violations").add({
                "grievanceId": g["onChainId"],
                "triggeredAt": now,
                "level": g["status"]
            })
```

This runs entirely within the free Render.com instance — no extra service, no cost.

---

### 8.3 Threshold Countdown in the UI

The frontend `StatusTracker` component:
- Reads `thresholdDeadline` from the Firestore cache
- Displays a live countdown: `"Auto-escalates in 2 days 4 hours"`
- Turns red when less than 24 hours remain
- Shows "Overdue — pending escalation" if past deadline

This creates accountability pressure on authorities — they can see the clock ticking.

---

## 9. Development Phases

### Phase 1 — Environment Setup (Week 1–2)

**Goal:** Every team member can run the full stack locally.

Tasks:
- [ ] Set up GitHub repository with branch protection rules
- [ ] Create `blockchain/`, `backend/`, `frontend/` directories
- [ ] Initialize Hardhat project (`npm init`, `npx hardhat init`)
- [ ] Initialize FastAPI project with `requirements.txt`
- [ ] Initialize Next.js project (`npx create-next-app`)
- [ ] Create Firebase project, enable Firestore + Authentication
- [ ] Create Pinata account, get API keys
- [ ] Create `.env.example` files for each sub-project
- [ ] Write `docker-compose.yml` for local development (backend only — no Redis needed)
- [ ] Set up ESLint, Prettier, Black (Python formatter), pre-commit hooks
- [ ] Set up GitHub Actions CI stub (lint + test on push)

**Deliverable:** `docker-compose up` spins up the backend. Hardhat local node runs. Frontend dev server runs.

---

### Phase 2 — Smart Contracts (Week 3–6)

**Goal:** All contract logic is implemented and fully tested.

Tasks:
- [ ] Write `RoleManager.sol` with OpenZeppelin AccessControl
- [ ] Write `GrievanceSystem.sol` — data structures, storage
- [ ] Implement `submitGrievance()`
- [ ] Implement `committeePropose()` + vote tallying + `executeCommitteeAction()`
- [ ] Implement `hodAction()` and `principalAction()`
- [ ] Implement `submitFeedback()` — satisfied routes to CLOSED, unsatisfied re-escalates
- [ ] Implement `castVote()` (upvote/downvote)
- [ ] Implement Chainlink `checkUpkeep()` + `performUpkeep()` with gas optimization
- [ ] Write `GrievanceFactory.sol`
- [ ] Write `IGrievanceSystem.sol` interface
- [ ] Write Hardhat deploy script
- [ ] Write unit tests — happy paths for all functions (target 90%+ coverage)
- [ ] Write edge case tests — duplicate votes, expired threshold, unauthorized actions
- [ ] Test Chainlink automation locally using Hardhat time manipulation (`evm_increaseTime`)
- [ ] Deploy to Polygon Mumbai testnet
- [ ] Verify contracts on Polygonscan

**Deliverable:** Contracts deployed on Mumbai. All tests pass. ABI exported for backend and frontend.

---

### Phase 3 — Backend (Week 7–11)

**Goal:** Full REST API operational, blockchain interactions working end-to-end.

Tasks:
- [ ] FastAPI app skeleton — CORS, middleware, error handlers
- [ ] `config.py` with pydantic-settings for all env vars
- [ ] Firebase Admin SDK init + token verification middleware
- [ ] `BlockchainService` — Web3.py connection, relay wallet pattern
- [ ] `IPFSService` — Pinata upload and retrieve
- [ ] `FirebaseService` — Firestore CRUD wrappers
- [ ] `EmailService` — SendGrid templates for all notification types
- [ ] Auth router — register, verify-token (validate institute email domain)
- [ ] Grievances router — submit (IPFS upload → contract call → Firestore cache write)
- [ ] Grievances router — list (Firestore, filtered by role)
- [ ] Grievances router — get (merge Firestore cache + on-chain action history)
- [ ] Grievances router — vote, feedback
- [ ] Committee router — propose, get votes, execute
- [ ] HoD router — action endpoint
- [ ] Principal router — action endpoint
- [ ] Admin router — user management, role assignment (Firebase custom claims + contract)
- [ ] Admin router — threshold configuration
- [ ] Analytics router — aggregation queries on Firestore
- [ ] APScheduler setup — register jobs in `app/main.py` startup event
- [ ] Threshold watchdog APScheduler job
- [ ] Email queue APScheduler job
- [ ] Write pytest tests for all routers (mock blockchain + Firebase)
- [ ] API documentation review (FastAPI auto-generates at `/docs`)

**Deliverable:** All API endpoints working. Postman collection exported. Tests pass.

---

### Phase 4 — Frontend (Week 12–16)

**Goal:** Full UI for all roles, connected to backend and Firebase real-time.

Tasks:
- [ ] Next.js project setup — TypeScript, Tailwind, shadcn/ui init
- [ ] Firebase client SDK setup
- [ ] Axios API client with auth token injection
- [ ] `useAuth` hook — Firebase auth state management
- [ ] Next.js middleware — role-based route protection
- [ ] Landing page — clean, professional (institute branding configurable)
- [ ] Login page — email/password + Google
- [ ] Register page — institute email validation, role shown after admin approval
- [ ] Student: Submit Grievance form — category/sub-cat, dept, rich text, file upload, anonymous toggle
- [ ] Student: Dashboard — grievance list with status badges
- [ ] Student: Grievance detail — StatusTracker, countdown timer, action history timeline, vote buttons, feedback form
- [ ] Committee: Dashboard — grievances list, vote tally badges
- [ ] Committee: Grievance detail — VotePanel with propose + cast vote
- [ ] HoD: Dashboard + ActionPanel
- [ ] Principal: Dashboard + ActionPanel
- [ ] Admin: Users page — table, role assignment dropdown
- [ ] Admin: Analytics page — KPI cards, Recharts charts
- [ ] Admin: Settings — threshold sliders, department management
- [ ] Notification bell — real-time Firestore listener, unread count badge
- [ ] Responsive design — mobile-first (many students will use phones)
- [ ] Dark mode support (Tailwind + shadcn/ui)
- [ ] Loading skeletons for all async data
- [ ] Empty states and error states for all pages

**Deliverable:** Full UI working end-to-end on localhost against Mumbai testnet.

---

### Phase 5 — Integration, Testing & Hardening (Week 17–19)

**Goal:** System is production-ready, secure, and performant.

Tasks:
- [ ] End-to-end test: Submit grievance → committee vote → HoD forward → Principal resolve → feedback
- [ ] End-to-end test: Time threshold auto-forward via Chainlink (on testnet)
- [ ] End-to-end test: Anonymous grievance — verify identity not revealed
- [ ] End-to-end test: Committee debar flow
- [ ] Load test: Simulate 100 concurrent students submitting grievances (k6 or Locust)
- [ ] Smart contract audit — run Slither (static analysis) and Mythril
- [ ] Fix all HIGH/MEDIUM severity findings from audit
- [ ] API security — rate limiting (in-process counter via FastAPI middleware), input validation, XSS headers
- [ ] Firebase security rules — tighten and test with Firebase emulator
- [ ] IPFS content pinning — ensure Pinata keeps files indefinitely (paid plan if needed)
- [ ] Error monitoring — integrate Sentry for backend + frontend
- [ ] Performance — verify in-process TTL cache is working on hot endpoints
- [ ] Accessibility audit — WCAG 2.1 AA compliance check
- [ ] Cross-browser testing — Chrome, Firefox, Safari, mobile

**Deliverable:** System passes all E2E tests. Security audit complete. Performance benchmarks met.

---

### Phase 6 — Deployment (Week 20–21)

**Goal:** System running in production, accessible to the institute.

Tasks:
- [ ] Deploy contracts to Polygon PoS mainnet
- [ ] Verify contracts on Polygonscan
- [ ] Dockerize backend
- [ ] Deploy backend to Render.com free tier (includes APScheduler — no separate worker needed)
- [ ] Deploy frontend to Vercel (free tier, best for Next.js)
- [ ] Configure custom domain (institute provides domain)
- [ ] Set up GitHub Actions CI/CD — auto-deploy on merge to `main`
- [ ] Configure Sentry alerts
- [ ] Set up uptime monitoring (Better Uptime or UptimeRobot)
- [ ] Institute admin onboarding — create admin account, configure institute settings
- [ ] Onboard first batch of users (students + authorities) with role assignment
- [ ] Run live pilot with a small group before full rollout
- [ ] Write user documentation (student guide, authority guide, admin guide)

**Deliverable:** System live at institute domain. Pilot group onboarded.

---

## 10. Folder Structure

Complete monorepo layout:

```
blockchain_based_grievance_management_system/
│
├── blockchain/                          # Hardhat smart contracts
│   ├── contracts/
│   │   ├── GrievanceFactory.sol
│   │   ├── GrievanceSystem.sol
│   │   ├── RoleManager.sol
│   │   └── interfaces/
│   │       └── IGrievanceSystem.sol
│   ├── scripts/
│   │   ├── deploy.ts
│   │   └── seed.ts
│   ├── test/
│   │   ├── GrievanceSystem.test.ts
│   │   ├── RoleManager.test.ts
│   │   └── Threshold.test.ts
│   ├── deployments/                     # JSON files with deployed addresses per network
│   ├── hardhat.config.ts
│   ├── package.json
│   └── .env.example
│
├── backend/                             # FastAPI Python backend
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── dependencies.py
│   │   ├── routers/
│   │   ├── services/
│   │   ├── models/
│   │   └── utils/
│   ├── scheduler/
│   │   └── jobs.py              # APScheduler jobs
│   ├── tests/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/                            # Next.js frontend
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── hooks/
│   ├── types/
│   ├── public/
│   ├── Dockerfile
│   ├── package.json
│   └── .env.local.example
│
├── docker-compose.yml                   # Local dev: backend only
├── docker-compose.prod.yml              # Production overrides
├── .github/
│   └── workflows/
│       ├── ci.yml                       # Lint + test on PR
│       └── deploy.yml                   # Deploy on merge to main
├── PLAN.md                              # This document
└── README.md
```

---

## 11. Deployment Strategy

### 11.1 Infrastructure (Cost-Optimized for Institute Budget)

| Component | Service | Cost |
|---|---|---|
| Frontend | Vercel (free tier) | Free |
| Backend (FastAPI + APScheduler) | Render.com free tier | Free |
| Firebase (Firestore + Auth) | Spark plan | Free |
| IPFS / Pinata | Free tier (1GB) | Free |
| Besu private network | Self-hosted (college server or local) | Free |
| Domain | Institute provides | — |
| **Total** | | **$0/month** |

When handing over to an institute for production, Render's paid tier (~$7/month) removes the sleep-on-idle behaviour — but that is the institute's cost, not yours during development.

---

### 11.2 Environment Variables

**backend/.env.example**
```env
# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...

# Blockchain
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
RELAY_WALLET_PRIVATE_KEY=0x...
CONTRACT_ADDRESS=0x...

# Pinata
PINATA_API_KEY=...
PINATA_SECRET_KEY=...

# SendGrid
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=grievance@institute.edu

# App
SECRET_KEY=...
ALLOWED_ORIGINS=https://grievance.institute.edu
```

**blockchain/.env.example**
```env
PRIVATE_KEY=0x...               # Deployer wallet
POLYGON_RPC_URL=...
MUMBAI_RPC_URL=...
POLYGONSCAN_API_KEY=...
```

**frontend/.env.local.example**
```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_API_URL=https://api.grievance.institute.edu
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_POLYGON_RPC=...
```

---

### 11.3 CI/CD Pipeline

**On every PR:**
1. Lint: ESLint (frontend), Flake8/Black (backend), Solhint (contracts)
2. Test: Hardhat tests, pytest, Next.js build check
3. Block merge if any fail

**On merge to `main`:**
1. Deploy contracts (if contract files changed) — run Hardhat deploy script
2. Deploy backend — push to GitHub triggers Render.com auto-deploy
3. Deploy frontend — Vercel auto-deploys from GitHub

---

## 12. Security Considerations

### 12.1 Smart Contract Security

| Threat | Mitigation |
|---|---|
| Reentrancy attacks | OpenZeppelin `ReentrancyGuard` on all state-changing functions |
| Unauthorized actions | `AccessControl` role checks on every function |
| Integer overflow | Solidity ^0.8.20 has built-in overflow checks |
| Timestamp manipulation | Use `block.timestamp` with awareness; threshold is in days so minor drift is acceptable |
| Front-running | Not a concern for grievance submission (no financial value) |
| Contract upgradability | Use OpenZeppelin Transparent Proxy pattern for upgradability |
| Chainlink manipulation | Chainlink nodes are decentralized; upkeep is append-only, not destructive |

**Pre-deployment:**
- Run Slither (`slither .`) — static analysis
- Run Mythril (`myth analyze`) — symbolic execution
- Manual code review by all team members
- Consider a third-party audit for production

---

### 12.2 Backend Security

- All endpoints require Firebase ID token verification
- Role checks at both Firebase custom claims level AND smart contract level
- Rate limiting via in-process counter middleware on all write endpoints (max 10 submissions per student per day)
- Input sanitization — Pydantic strips unexpected fields
- File upload validation — MIME type check, file size limits, virus scan (ClamAV or VirusTotal API)
- Relay wallet private key in environment variable, never in code
- HTTPS only — enforced by Vercel and Render.com

---

### 12.3 Frontend Security

- No private keys ever in the browser (relay wallet pattern)
- Firebase token stored in memory (not localStorage) — resistant to XSS
- Content Security Policy headers via Next.js config
- All user-generated content sanitized before render (DOMPurify)
- Anonymous grievances — student UID is never sent to contract; only `keccak256(uid)` which cannot be reversed

---

### 12.4 Privacy

- Anonymous grievance option: the student's identity is hashed on-chain. The backend knows the mapping (in Firestore) but the hash on-chain reveals nothing.
- For non-anonymous grievances, student name is stored in IPFS metadata (not on Polygonscan directly).
- GDPR consideration: if the institute is in the EU, implement a right-to-erasure flow for off-chain data (Firestore). On-chain data is immutable by design — this should be disclosed to users.

---

## 13. Improvements Over Original Research

The original 2018 research paper proposed a solid foundation. Here is how this implementation improves on it:

| Area | Original Paper | This Implementation |
|---|---|---|
| **Blockchain** | Hyperledger Fabric 1.1 | Solidity + Polygon PoS — EVM-compatible, cheaper, easier to develop |
| **Threshold** | Mentioned conceptually | Fully implemented with APScheduler (in-process, no external service, free) |
| **Document storage** | Not addressed | IPFS via Pinata — decentralized, content-addressed, permanent |
| **Consensus** | Mentioned conceptually | Fully on-chain voting with majority rule, all votes recorded |
| **Privacy** | Anonymous option mentioned | keccak256 hashing of student ID on-chain; Firestore holds mapping server-side |
| **Multi-institute** | Single institute | Factory pattern — one codebase, unlimited institutes |
| **Frontend** | Not specified | Next.js — real-time updates, mobile responsive, accessible |
| **Notifications** | Not addressed | Firebase real-time + SendGrid email on every state change |
| **Analytics** | Statistics mentioned | Full analytics dashboard with charts, dept breakdowns, resolution time trends |
| **Auth** | Not specified | Firebase Auth with institute email domain validation |
| **Upgradability** | Not addressed | OpenZeppelin Transparent Proxy for contract upgrades without data loss |
| **Security audit** | Not addressed | Slither + Mythril + manual review before mainnet |
| **Upvote/Downvote** | Mentioned | Implemented on-chain (one vote per student per grievance) |
| **Cost** | Enterprise setup | $0/month — fully free stack for personal/dev use |

### Additional features not in the original paper:

- **Rich text grievance descriptions** with file attachments
- **Department-routing** — grievance goes to the HoD of the correct department
- **Countdown timer** UI showing time before auto-escalation
- **Audit trail timeline** — every action rendered with actor, timestamp, remarks
- **Admin panel** — manage users, roles, departments, thresholds through UI
- **Export to CSV** — for institute records and compliance
- **Dark mode**
- **Mobile responsive design** — students can submit grievances from phones
- **CI/CD pipeline** — automated testing and deployment
- **Docker** — reproducible local development environment

---

*This plan is a living document. Update it as decisions are made during implementation.*

*Last updated: April 2026*
