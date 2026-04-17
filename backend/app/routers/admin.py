import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.config import Settings, get_settings
from app.dependencies import require_role
from app.models.action import AddDepartmentRequest, AssignRoleRequest, ThresholdUpdateRequest
from app.models.user import UserProfile
from app.services.blockchain import BlockchainService, GrievanceStatus, get_blockchain_service
from app.services.firebase import FirebaseService, get_firebase_service

logger = logging.getLogger(__name__)
router = APIRouter()

# Seconds per day — used when converting day-based thresholds to seconds for the contract
_SECONDS_PER_DAY = 86_400


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get(
    "/users",
    response_model=list[UserProfile],
    summary="List all users in the institute",
)
async def list_users(
    role:         str | None     = None,
    current_user: dict           = Depends(require_role("admin")),
    fb:           FirebaseService = Depends(get_firebase_service),
    settings:     Settings        = Depends(get_settings),
) -> list[UserProfile]:
    """Returns all user profiles, optionally filtered by role."""
    query = fb._db.collection("users").where("instituteId", "==", settings.institute_id)
    if role:
        query = query.where("role", "==", role)

    return [
        UserProfile(
            uid=d.get("uid", ""),
            display_name=d.get("displayName", ""),
            email=d.get("email", ""),
            role=d.get("role", "student"),
            department=d.get("department", ""),
            institute_id=d.get("instituteId", ""),
            wallet_address=d.get("walletAddress", ""),
        )
        for doc in query.stream()
        if (d := doc.to_dict())
    ]


@router.post(
    "/users/{uid}/role",
    response_model=UserProfile,
    summary="Assign or change a user's role",
)
async def assign_role(
    uid:          str,
    body:         AssignRoleRequest,
    current_user: dict              = Depends(require_role("admin")),
    fb:           FirebaseService   = Depends(get_firebase_service),
    settings:     Settings          = Depends(get_settings),
) -> UserProfile:
    """
    Assigns a role to a user and sets the department if relevant.
    Also updates the Firebase custom claim so the new role takes
    effect on the next token refresh.
    Token revocation ensures stale tokens stop working immediately.
    """
    profile = fb.get_user_profile(uid)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found.")

    # Update Firebase custom claim
    fb.set_user_role(uid, role=body.role, institute_id=settings.institute_id)

    # Revoke existing tokens so old role claim can't be reused
    fb.revoke_user_tokens(uid)

    # Update Firestore profile
    updates: dict = {"role": body.role}
    if body.department:
        updates["department"] = body.department
    fb.update_user_profile(uid, updates)

    logger.info("Admin assigned role=%s to uid=%s", body.role, uid)

    return UserProfile(
        uid=uid,
        display_name=profile.get("displayName", ""),
        email=profile.get("email", ""),
        role=body.role,
        department=body.department or profile.get("department", ""),
        institute_id=settings.institute_id,
        wallet_address=profile.get("walletAddress", ""),
    )


@router.delete(
    "/users/{uid}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a user from the institute",
)
async def remove_user(
    uid:          str,
    current_user: dict              = Depends(require_role("admin")),
    fb:           FirebaseService   = Depends(get_firebase_service),
) -> None:
    """
    Revokes the user's tokens and removes their Firestore profile.
    Does not delete the Firebase Auth account (preserves email history).
    """
    if not fb.get_user_profile(uid):
        raise HTTPException(status_code=404, detail="User not found.")
    fb.revoke_user_tokens(uid)
    fb._db.collection("users").document(uid).delete()
    logger.info("Admin removed uid=%s", uid)


# ── Thresholds ────────────────────────────────────────────────────────────────

@router.get(
    "/thresholds",
    summary="Get current threshold durations for each level",
)
async def get_thresholds(
    current_user: dict              = Depends(require_role("admin")),
    bc:           BlockchainService = Depends(get_blockchain_service),
) -> dict:
    """Returns threshold durations in days for each authority level."""
    committee_secs  = await bc.get_threshold_duration(GrievanceStatus.AT_COMMITTEE)
    hod_secs        = await bc.get_threshold_duration(GrievanceStatus.AT_HOD)
    principal_secs  = await bc.get_threshold_duration(GrievanceStatus.AT_PRINCIPAL)
    return {
        "committee_days":  committee_secs  // _SECONDS_PER_DAY,
        "hod_days":        hod_secs        // _SECONDS_PER_DAY,
        "principal_days":  principal_secs  // _SECONDS_PER_DAY,
    }


@router.put(
    "/thresholds",
    summary="Update threshold durations for each level",
)
async def update_thresholds(
    body:         ThresholdUpdateRequest,
    current_user: dict              = Depends(require_role("admin")),
    bc:           BlockchainService = Depends(get_blockchain_service),
) -> dict:
    """
    Updates the time threshold for one or more authority levels.
    Only fields provided in the request body are changed.
    """
    updated = {}

    if body.committee_days is not None:
        await bc.set_threshold(GrievanceStatus.AT_COMMITTEE, body.committee_days * _SECONDS_PER_DAY)
        updated["committee_days"] = body.committee_days

    if body.hod_days is not None:
        await bc.set_threshold(GrievanceStatus.AT_HOD, body.hod_days * _SECONDS_PER_DAY)
        updated["hod_days"] = body.hod_days

    if body.principal_days is not None:
        await bc.set_threshold(GrievanceStatus.AT_PRINCIPAL, body.principal_days * _SECONDS_PER_DAY)
        updated["principal_days"] = body.principal_days

    if not updated:
        raise HTTPException(status_code=400, detail="No threshold values provided.")

    logger.info("Admin updated thresholds: %s", updated)
    return {"updated": updated, "message": "Thresholds updated on-chain."}


# ── Departments ───────────────────────────────────────────────────────────────

@router.get(
    "/departments",
    summary="List all departments in the institute",
)
async def list_departments(
    current_user: dict              = Depends(require_role("admin", "committee", "hod", "principal", "student")),
    fb:           FirebaseService   = Depends(get_firebase_service),
    settings:     Settings          = Depends(get_settings),
) -> list:
    """Returns the list of departments. Used to populate dropdowns in the frontend."""
    institute = fb.get_institute(settings.institute_id)
    departments = institute.get("departments", []) if institute else []
    return departments


@router.post(
    "/departments",
    status_code=status.HTTP_201_CREATED,
    summary="Add a new department",
)
async def add_department(
    body:         AddDepartmentRequest,
    current_user: dict              = Depends(require_role("admin")),
    fb:           FirebaseService   = Depends(get_firebase_service),
    settings:     Settings          = Depends(get_settings),
) -> dict:
    """Adds a department to the institute's Firestore config."""
    from google.cloud.firestore_v1 import ArrayUnion
    fb._db.collection("institutes").document(settings.institute_id).set(
        {"departments": ArrayUnion([body.name])}, merge=True
    )
    logger.info("Admin added department: %s", body.name)
    return {"message": f"Department '{body.name}' added."}


@router.delete(
    "/departments/{name}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a department",
)
async def remove_department(
    name:         str,
    current_user: dict              = Depends(require_role("admin")),
    fb:           FirebaseService   = Depends(get_firebase_service),
    settings:     Settings          = Depends(get_settings),
) -> None:
    from google.cloud.firestore_v1 import ArrayRemove
    fb._db.collection("institutes").document(settings.institute_id).set(
        {"departments": ArrayRemove([name])}, merge=True
    )


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get(
    "/analytics/overview",
    summary="Get KPI counts for the analytics dashboard",
)
async def analytics_overview(
    current_user: dict              = Depends(require_role("admin", "principal")),
    fb:           FirebaseService   = Depends(get_firebase_service),
    bc:           BlockchainService = Depends(get_blockchain_service),
    settings:     Settings          = Depends(get_settings),
) -> dict:
    """
    Returns total grievances, counts by status, and total on-chain count.
    Reads from Firestore cache — no RPC cost for counts.
    """
    counts = fb.get_grievance_counts(settings.institute_id)
    total_cache = sum(counts.values())
    total_chain = await bc.total_grievances()

    return {
        "total":             total_chain,
        "by_status":         counts,
        "pending":           counts.get("AtCommittee", 0) + counts.get("AtHoD", 0) + counts.get("AtPrincipal", 0),
        "resolved":          counts.get("Closed", 0),
        "awaiting_feedback": counts.get("AwaitingFeedback", 0),
        "debarred":          counts.get("Debarred", 0),
        "cache_total":       total_cache,
    }


@router.get(
    "/analytics/by-dept",
    summary="Get per-department grievance breakdown",
)
async def analytics_by_dept(
    current_user: dict              = Depends(require_role("admin", "principal")),
    fb:           FirebaseService   = Depends(get_firebase_service),
    settings:     Settings          = Depends(get_settings),
) -> list:
    """Returns total and resolved counts per department for the bar chart."""
    return fb.get_grievances_by_department(settings.institute_id)
