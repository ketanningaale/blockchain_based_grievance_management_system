# Blockchain-Based Grievance Redressal System

A production-ready grievance management system for educational institutes, built on a blockchain (Hyperledger Besu private network or Ethereum Sepolia testnet) with Solidity smart contracts, a Python FastAPI backend, and a Next.js 14 frontend.

> Based on research by Ketan Ingale, Nishant Dalvi, Rakshitha Shettigar, Farhan Ansari & Ramkrushna Maheshwar — IIIT Pune.

---

## Build Status

| Layer | Status | Detail |
|---|---|---|
| Smart Contracts (Solidity) | ✅ Complete | RoleManager, GrievanceSystem, GrievanceFactory |
| Contract Tests (Hardhat) | ✅ Complete | 45 tests — full lifecycle coverage |
| Backend Services (Python) | ✅ Complete | Firebase, Blockchain, IPFS, Email, Scheduler |
| Backend API Routers | ✅ Complete | auth, grievances, committee, hod, principal, admin |
| Frontend — Auth | ✅ Complete | Login, register, Firebase auth, role-based middleware |
| Frontend — Student UI | ✅ Complete | Dashboard, submit form, grievance detail + feedback |
| Frontend — Committee UI | ✅ Complete | Dashboard, vote tally, propose and execute actions |
| Frontend — HoD UI | ✅ Complete | Dashboard, forward / resolve / revert |
| Frontend — Principal UI | ✅ Complete | Dashboard, resolve / revert |
| Frontend — Admin UI | ✅ Complete | Analytics, user management, threshold + department settings |
| Infrastructure | ✅ Complete | Docker, GitHub Actions CI/CD, deploy-contracts workflow |

See [PLAN.md](./PLAN.md) for the full implementation plan and detailed progress tracker.

---

## Documentation

| Guide | Description |
|---|---|
| [docs/architecture.md](./docs/architecture.md) | Technical architecture: components, data flow, design decisions |
| [docs/deployment.md](./docs/deployment.md) | Step-by-step: Firebase → Pinata → Render.com → Vercel |
| [docs/besu-network.md](./docs/besu-network.md) | IBFT 2.0 3-node private Besu network + genesis.json |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Solidity 0.8.20 on Hyperledger Besu (private) or Ethereum Sepolia (testnet) |
| Contract tooling | Hardhat + OpenZeppelin Contracts 5.0 |
| Backend | Python 3.11 + FastAPI + Web3.py |
| Scheduler | APScheduler (in-process — no Redis/Celery needed) |
| Auth + DB | Firebase Auth + Firestore |
| File storage | IPFS via Pinata |
| Email | SendGrid |
| Frontend | Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui |
| Deployment | Vercel (frontend) + Render.com free tier (backend) |

**Total infrastructure cost: $0/month** for personal/development use.

---

## Project Structure

```
blockchain_based_grievance_management_system/
├── blockchain/          # Hardhat project — Solidity contracts, tests, deploy scripts
│   ├── contracts/
│   │   ├── RoleManager.sol        # OpenZeppelin AccessControl (5 roles)
│   │   ├── GrievanceSystem.sol    # Core grievance lifecycle + committee voting
│   │   └── GrievanceFactory.sol   # Multi-institute factory pattern
│   ├── scripts/
│   │   ├── deploy.ts
│   │   └── export-abis.ts
│   └── test/                      # 45 Hardhat tests
├── backend/             # FastAPI Python backend
│   ├── app/
│   │   ├── main.py                # App factory, CORS, error handlers
│   │   ├── config.py              # All env vars via pydantic-settings
│   │   ├── dependencies.py        # Auth middleware, role enforcement
│   │   ├── routers/               # auth, grievances, committee, hod, principal, admin
│   │   ├── services/              # blockchain, firebase, ipfs, email
│   │   └── models/                # Pydantic request/response schemas
│   └── scheduler/                 # APScheduler jobs: threshold watchdog + email queue
├── frontend/            # Next.js 14 frontend
│   ├── app/
│   │   ├── (auth)/               # login, register
│   │   ├── student/              # dashboard, submit, grievance detail
│   │   ├── committee/            # dashboard, voting detail
│   │   ├── hod/                  # dashboard, action page
│   │   ├── principal/            # dashboard, action page
│   │   └── admin/                # analytics, users, settings
│   ├── components/               # GrievanceCard, ActionPanel, StaffLayout, etc.
│   ├── hooks/                    # useAuth
│   └── lib/                     # api.ts (Axios), firebase.ts, utils.ts
├── docs/
│   ├── architecture.md
│   ├── deployment.md
│   └── besu-network.md
├── .github/workflows/
│   ├── ci.yml                    # Lint + test on every PR
│   ├── cd.yml                    # Deploy to Render + Vercel on merge to main
│   └── deploy-contracts.yml      # Compile, deploy to Sepolia, export ABIs
├── docker-compose.yml
├── firestore.indexes.json
├── PLAN.md
└── README.md
```

---

## Quick Start (Local Development)

### Prerequisites

- Node.js 18+, Python 3.11+, Docker (optional)
- A Firebase project with Email/Password auth and Firestore enabled
- A Pinata account (free tier) for IPFS

### 1. Contracts

```bash
cd blockchain
npm install
npx hardhat node                          # starts local EVM on :8545

# In a new terminal:
npm run compile
npm run export-abis                       # copies ABIs → backend/app/services/abis/
npx hardhat run scripts/deploy.ts --network localhost
```

### 2. Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                      # fill in Firebase + contract addresses
uvicorn app.main:app --reload
# Interactive API docs: http://localhost:8000/docs
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local          # fill in Firebase + API URL
npm run dev
# App: http://localhost:3000
```

### 4. Using Docker Compose

```bash
cp backend/.env.example backend/.env      # fill in values
docker compose up --build                 # starts backend on :8000
```

---

## Grievance Lifecycle

```
Student submits
  └─► Committee votes (majority rule)
        ├─► Resolve → AwaitingFeedback → Student feedback
        │     └─► Satisfied → Closed
        │     └─► Unsatisfied → back to Committee
        ├─► Forward → HoD acts
        │     ├─► Resolve → AwaitingFeedback
        │     ├─► Forward → Principal acts
        │     │     ├─► Resolve → AwaitingFeedback
        │     │     └─► Revert → back to Committee
        │     └─► Revert → back to Committee
        └─► Debar → Debarred (closed without resolution)
```

**Key properties:**
- Every state change is recorded as an **immutable on-chain action** — nothing can be tampered with after the fact.
- If any level ignores a grievance past its deadline, **APScheduler auto-escalates** it to the next level (default: Committee 7 days, HoD 5 days, Principal 3 days — configurable from the Admin panel).
- **Anonymous grievances** hide the student's identity from all authority dashboards. Identity is hashed with keccak256 on-chain.
- **Submission is asynchronous**: IPFS upload happens synchronously, then blockchain confirmation runs in the background (avoids Render's 30-second HTTP timeout on Sepolia). The grievance appears in the dashboard within ~1–2 minutes.

---

## Roles

| Role | Description |
|---|---|
| `student` | Submit grievances, vote on others', give feedback |
| `committee` | Vote to forward / resolve / debar grievances in their department |
| `hod` | Forward / resolve / revert grievances in their department |
| `principal` | Resolve or revert grievances escalated from HoD |
| `admin` | Manage users, set thresholds, view analytics |

**Assigning roles:** Admin logs in → Admin → Users → click Edit next to a user → change role. The user must sign out and back in to receive the new Firebase custom claim.

**Committee voting:** The default committee size is 3, requiring a majority (2 votes) to execute any action. For development with a single committee account, set committee size to 1 via Admin → Settings → Committee Size.

---

## API Reference

FastAPI auto-generates interactive docs at `/docs` (disabled in production).

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/auth/register` | POST | Student self-registration (institute email only) |
| `/api/v1/auth/verify-token` | POST | Validate Firebase token, return role + profile |
| `/api/v1/auth/me` | GET | Current user profile |
| `/api/v1/grievances/` | POST | Submit grievance (multipart/form-data, returns 202) |
| `/api/v1/grievances/` | GET | List grievances filtered by caller's role |
| `/api/v1/grievances/{id}` | GET | Full detail + on-chain audit trail |
| `/api/v1/grievances/{id}/history` | GET | On-chain action history only |
| `/api/v1/grievances/{id}/vote` | POST | Upvote or downvote |
| `/api/v1/grievances/{id}/feedback` | POST | Satisfaction feedback |
| `/api/v1/committee/{id}/propose` | POST | Propose an action with remarks |
| `/api/v1/committee/{id}/votes` | GET | Current vote tally |
| `/api/v1/committee/{id}/execute` | POST | Execute when majority reached |
| `/api/v1/hod/{id}/action` | POST | HoD: forward / revert / resolve |
| `/api/v1/principal/{id}/action` | POST | Principal: resolve / revert |
| `/api/v1/admin/users` | GET | All users in institute |
| `/api/v1/admin/users/{uid}/role` | PUT | Assign or change a user's role |
| `/api/v1/admin/thresholds` | GET/PUT | Read or update escalation deadlines |
| `/api/v1/admin/departments` | GET/POST | List and add departments |
| `/api/v1/admin/analytics/overview` | GET | KPI data for analytics dashboard |
| `/api/v1/admin/analytics/by-dept` | GET | Per-department breakdown |
| `/health` | GET | Backend health + blockchain connection status |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `APP_ENV` | No | `development` or `production` (disables /docs in prod) |
| `SECRET_KEY` | Yes | Session signing key |
| `ALLOWED_ORIGINS` | Yes | Frontend URL(s), comma-separated. Use `*` for dev |
| `BESU_RPC_URL` | Yes | RPC endpoint — Hardhat local, Besu VPS, or Alchemy Sepolia URL |
| `RELAY_WALLET_PRIVATE_KEY` | Yes | Private key of the relay wallet that signs all blockchain txs |
| `CONTRACT_ROLE_MANAGER` | Yes | Deployed RoleManager contract address |
| `CONTRACT_GRIEVANCE_SYSTEM` | Yes | Deployed GrievanceSystem contract address |
| `RELAY_GAS_PRICE` | No | `0` for Besu/Hardhat (free gas). `-1` to auto-detect (Sepolia) |
| `FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `FIREBASE_PRIVATE_KEY` | Yes | Firebase service account private key |
| `FIREBASE_CLIENT_EMAIL` | Yes | Firebase service account email |
| `FIREBASE_PRIVATE_KEY_ID` | Yes | Firebase service account key ID |
| `FIREBASE_CLIENT_ID` | Yes | Firebase service account client ID |
| `FIREBASE_CLIENT_CERT_URL` | Yes | Firebase service account cert URL |
| `INSTITUTE_ID` | Yes | Identifier for your institute (e.g. `institute_001`) |
| `INSTITUTE_EMAIL_DOMAIN` | Yes | Domain used to validate student registration (e.g. `college.edu.in`) |
| `PINATA_API_KEY` | Yes | Pinata API key for IPFS uploads |
| `PINATA_SECRET_KEY` | Yes | Pinata secret key |
| `PINATA_GATEWAY` | No | IPFS gateway URL (default: `https://gateway.pinata.cloud`) |
| `SENDGRID_API_KEY` | No | SendGrid API key — leave blank to skip emails |
| `SENDGRID_FROM_EMAIL` | No | Sender email address |
| `THRESHOLD_CHECK_INTERVAL_MINUTES` | No | How often APScheduler checks thresholds (default: 30) |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL (e.g. `https://your-service.onrender.com`) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web app API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |
| `NEXT_PUBLIC_PINATA_GATEWAY` | IPFS gateway for fetching content |

---

## Deploying to Sepolia (Online, No Local Node)

The included GitHub Actions workflow handles this automatically:

1. Add `RELAY_WALLET_PRIVATE_KEY` and `ALCHEMY_SEPOLIA_URL` as GitHub repository secrets.
2. Go to **Actions → Deploy Contracts to Sepolia → Run workflow**.
3. The workflow compiles, runs tests, deploys both contracts, and exports ABIs back to the repo.
4. Copy the two contract addresses from the workflow output into Render environment variables.

See [docs/deployment.md](./docs/deployment.md) for the complete step-by-step guide.

---

## Security Notes

- The relay wallet private key must be kept in secrets — never commit it. Rotate it if compromised.
- Student identities are hashed with keccak256 before going on-chain. Anonymous submissions cannot be de-anonymized from on-chain data alone.
- All backend endpoints require a valid Firebase ID token in the `Authorization: Bearer <token>` header.
- Role enforcement is double-checked: once in FastAPI (via `require_role()`) and once in the smart contract (via OpenZeppelin AccessControl).
- CORS is set to `*` in development. In production, set `ALLOWED_ORIGINS` to the exact Vercel URL.

---

## Contributing

1. Create a feature branch: `git checkout -b feature/my-change`
2. Backend tests: `cd backend && pytest`
3. Contract tests: `cd blockchain && npm test`
4. Frontend type-check: `cd frontend && npm run type-check`
5. CI runs automatically on pull requests.
