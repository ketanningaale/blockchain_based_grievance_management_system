# Deployment Guide — Render.com (backend) + Vercel (frontend)

All services on the free tier. Total cost: **$0/month**.

---

## Architecture

```
User → Vercel (Next.js) → Render.com (FastAPI) → Besu node (VPS/self-hosted)
                                       ↕                      ↕
                               Firebase Firestore        IPFS (Pinata)
```

---

## 1. Firebase Setup

1. Go to https://console.firebase.google.com → **Create project**
2. Enable **Authentication** → Sign-in method → **Email/Password**
3. Enable **Firestore Database** → Start in production mode
4. **Project Settings → Service Accounts → Generate new private key** → download JSON
5. Extract fields from the JSON into the backend `.env` variables (see `.env.example`)

---

## 2. Pinata (IPFS) Setup

1. Sign up at https://app.pinata.cloud (free tier: 1 GB storage)
2. **API Keys → New Key** → check `pinFileToIPFS` + `pinJSONToIPFS`
3. Copy `API Key` → `PINATA_API_KEY` and `API Secret` → `PINATA_SECRET_KEY`

---

## 3. SendGrid (Email) Setup

1. Sign up at https://sendgrid.com (free tier: 100 emails/day)
2. **Settings → API Keys → Create API Key** (full access)
3. Copy to `SENDGRID_API_KEY`
4. Verify the sender email under **Sender Authentication**

> **Skip email entirely in dev:** Leave `SENDGRID_API_KEY` blank — the email service gracefully no-ops.

---

## 4. Deploy Backend to Render.com

### One-time setup

1. Push your code to GitHub
2. Go to https://render.com → **New → Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Root directory:** `backend`
   - **Runtime:** Docker *(uses the existing `backend/Dockerfile`)*
   - **Branch:** `main`
5. Under **Environment Variables**, add every key from `backend/.env.example` with real values
6. Click **Create Web Service**

Render auto-deploys every push to `main`. Your backend URL will be `https://your-service.onrender.com`.

### Optional: Deploy Hook for GitHub Actions CD

In the Render dashboard → your service → **Settings → Deploy Hook** → copy the URL.
Add it as `RENDER_DEPLOY_HOOK_URL` in your GitHub repo **Settings → Secrets and variables → Actions**.

---

## 5. Deploy Frontend to Vercel

### One-time setup

1. Go to https://vercel.com → **Add New Project**
2. Import your GitHub repository
3. Set **Root Directory** to `frontend`
4. Under **Environment Variables**, add:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | Your Render.com URL, e.g. `https://your-service.onrender.com` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | From Firebase project settings |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | From Firebase project settings |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | From Firebase project settings |
| `NEXT_PUBLIC_PINATA_GATEWAY` | `https://gateway.pinata.cloud` |

5. Click **Deploy**

Vercel auto-deploys every push to `main`. Your frontend URL will be `https://your-project.vercel.app`.

### Optional: CLI-driven deploys via GitHub Actions

```bash
npm install -g vercel
vercel link          # creates .vercel/project.json
```

Copy `orgId` and `projectId` from `.vercel/project.json` and add as GitHub secrets:
- `VERCEL_TOKEN` — from vercel.com → Settings → Tokens
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

The `cd.yml` workflow will then deploy on every push to `main`.

---

## 6. Update CORS Origin

Once you have the Vercel URL, update the backend environment variable:

```
ALLOWED_ORIGINS=https://your-project.vercel.app
```

---

## 7. Besu Network

See [besu-network.md](./besu-network.md) for the full private network setup.

For a production Besu network, you need a VPS (e.g. Oracle Cloud free tier — 2 vCPUs, 1 GB RAM is enough for a single-node dev setup). Update:

```
BESU_RPC_URL=http://YOUR_VPS_IP:8545
```

> Ensure port 8545 is accessible from your Render.com backend (allow the Render IP range in your VPS firewall, or use Tailscale/WireGuard for a private tunnel).

---

## 8. GitHub Actions CI/CD

The workflows in `.github/workflows/` run automatically:

| Workflow | Trigger | Jobs |
|---|---|---|
| `ci.yml` | PR to main, push to main | Backend tests, Frontend type-check + lint, Solidity compile + tests |
| `cd.yml` | Push to main only | Trigger Render deploy hook, Vercel production deploy |

No additional setup needed if you use Render/Vercel GitHub integration — the CD workflow degrades gracefully when secrets are absent.

---

## Quick Start (local dev)

```bash
# 1. Clone
git clone https://github.com/yourname/blockchain_based_grievance_management_system
cd blockchain_based_grievance_management_system

# 2. Backend
cp backend/.env.example backend/.env   # fill in values
docker compose up --build              # starts FastAPI on :8000

# 3. Blockchain (separate terminal, on your local machine)
cd blockchain
npm install
npx hardhat node                       # local EVM on :8545
npx hardhat run scripts/deploy.ts --network localhost
npm run export-abis

# 4. Frontend (separate terminal)
cd frontend
cp .env.local.example .env.local       # fill in Firebase values
npm install
npm run dev                            # Next.js on :3000
```
