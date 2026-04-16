# Blockchain-Based Grievance Redressal System

A production-ready grievance management system for educational institutes, built on a private Hyperledger Besu blockchain with Solidity smart contracts, a Python FastAPI backend, and a Next.js frontend.

> Based on research by Ketan Ingale, Nishant Dalvi, Rakshitha Shettigar, Farhan Ansari & Ramkrushna Maheshwar — IIIT Pune.

---

## Current Build Status

| Layer | Status | Detail |
|---|---|---|
| Smart Contracts (Solidity) | Complete | RoleManager, GrievanceSystem, GrievanceFactory |
| Contract Tests (Hardhat) | Complete | 45 tests — full lifecycle coverage |
| Backend Services (Python) | Complete | Firebase, Blockchain, IPFS, Email, Scheduler |
| Backend API Routers | Complete | auth, grievances, committee, hod, principal, admin |
| Frontend — Scaffold + Auth | Complete | Next.js 14, login/register pages, middleware |
| Frontend — Student UI | Complete | Dashboard, submit, and grievance detail page |
| Frontend — Committee UI | Complete | Dashboard + voting detail page |
| Frontend — HoD UI | Complete | Dashboard + Forward/Resolve/Revert action page |
| Frontend — Principal UI | Complete | Dashboard + Resolve/Revert action page |
| Frontend — Admin UI | Complete | Analytics charts, user management, settings (thresholds + departments) |

See [PLAN.md](./PLAN.md) for the full implementation plan and detailed progress tracker.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Solidity 0.8.20 + Hyperledger Besu (private EVM network) |
| Contract tooling | Hardhat + OpenZeppelin |
| Backend | Python 3.11 + FastAPI + Web3.py |
| Scheduler | APScheduler (in-process, replaces Celery+Redis) |
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
├── blockchain/          # Hardhat project — Solidity contracts + tests + deploy
│   ├── contracts/
│   │   ├── RoleManager.sol
│   │   ├── GrievanceSystem.sol
│   │   └── GrievanceFactory.sol
│   ├── test/
│   └── scripts/
├── backend/             # FastAPI Python backend
│   ├── app/
│   │   ├── routers/     # auth, grievances, committee, hod, principal, admin
│   │   ├── services/    # blockchain, firebase, ipfs, email
│   │   └── models/
│   └── scheduler/       # APScheduler jobs (threshold watchdog + email queue)
├── frontend/            # Next.js 14 frontend (in progress)
├── PLAN.md              # Full implementation plan + progress tracker
└── README.md
```

---

## Quick Start (Local Development)

### 1. Contracts

```bash
cd blockchain
npm install
npx hardhat node          # start local Hardhat node

# In a new terminal:
npm run compile
npm run export-abis       # copies ABIs to backend/app/services/abis/
npm run deploy:local
npm test
```

### 2. Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # fill in Firebase + contract addresses from deploy output
uvicorn app.main:app --reload
# API docs available at http://localhost:8000/docs
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # fill in Firebase + API URL
npm run dev
# App available at http://localhost:3000
```

---

## Grievance Lifecycle

```
Student submits → Committee votes (resolve / forward / debar)
  → HoD acts (resolve / forward / revert)
    → Principal acts (resolve / revert)
      → Student feedback (satisfied → Closed | unsatisfied → back to Committee)
```

- Every state change is recorded as an **immutable on-chain action** — no authority can tamper with the history.
- If any level ignores a grievance past its deadline, **APScheduler auto-escalates** it to the next level.
- Anonymous grievances hide the student's identity from all authority dashboards.

---

## API Reference

FastAPI auto-generates interactive docs at `/docs` in development.

| Prefix | Description |
|---|---|
| `POST /api/v1/auth/register` | Student self-registration (institute email only) |
| `POST /api/v1/auth/verify-token` | Validate Firebase token, get role |
| `GET/POST /api/v1/grievances/` | Submit + list grievances |
| `GET /api/v1/grievances/{id}` | Full detail + on-chain audit trail |
| `POST /api/v1/committee/{id}/propose` | Committee member votes |
| `POST /api/v1/committee/{id}/execute` | Execute action when majority reached |
| `POST /api/v1/hod/{id}/action` | HoD: forward / revert / resolve |
| `POST /api/v1/principal/{id}/action` | Principal: resolve / revert |
| `GET/PUT /api/v1/admin/thresholds` | Read/update auto-escalation deadlines |
| `GET /api/v1/admin/analytics/overview` | KPI dashboard data |
