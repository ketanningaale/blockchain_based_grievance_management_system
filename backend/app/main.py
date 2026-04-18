from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from scheduler.jobs import start_scheduler, stop_scheduler

settings = get_settings()


# ── Lifespan (startup + shutdown) ────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs on startup: initialise APScheduler background jobs.
    Runs on shutdown: gracefully stop the scheduler.
    """
    start_scheduler()
    yield
    stop_scheduler()


# ── App factory ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Grievance Redressal System API",
    description="Blockchain-backed grievance management for institutes.",
    version="1.0.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Bearer-token auth (Authorization header) does not require allow_credentials.
# When ALLOWED_ORIGINS=* we open to all origins; otherwise restrict to the list.

_origins     = settings.origins_list
_wildcard    = _origins == ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _wildcard else _origins,
    allow_credentials=not _wildcard,   # can't combine credentials=True with *
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global error handlers ─────────────────────────────────────────────────────

@app.exception_handler(ValueError)
async def value_error_handler(_: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(PermissionError)
async def permission_error_handler(_: Request, exc: PermissionError) -> JSONResponse:
    return JSONResponse(status_code=403, content={"detail": str(exc)})


# ── Routers ───────────────────────────────────────────────────────────────────
# Imported here after app is created to avoid circular imports.
# Each router is added as we build them in later steps.

from app.routers import auth, grievances, committee, hod, principal, admin  # noqa: E402
from app.services.blockchain import get_blockchain_service  # noqa: E402

app.include_router(auth.router,        prefix="/api/v1/auth",        tags=["auth"])
app.include_router(grievances.router,  prefix="/api/v1/grievances",   tags=["grievances"])
app.include_router(committee.router,   prefix="/api/v1/committee",    tags=["committee"])
app.include_router(hod.router,         prefix="/api/v1/hod",          tags=["hod"])
app.include_router(principal.router,   prefix="/api/v1/principal",    tags=["principal"])
app.include_router(admin.router,       prefix="/api/v1/admin",        tags=["admin"])


# ── Root ──────────────────────────────────────────────────────────────────────

@app.get("/", tags=["health"])
async def root() -> dict:
    return {
        "name":    "Grievance Redressal System API",
        "version": "1.0.0",
        "status":  "running",
        "docs":    "/docs" if not settings.is_production else "disabled in production",
    }


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["health"])
async def health() -> dict:
    bc_connected = await get_blockchain_service().is_connected()
    return {
        "status":     "ok",
        "env":        settings.app_env,
        "blockchain": "connected" if bc_connected else "unreachable",
    }
