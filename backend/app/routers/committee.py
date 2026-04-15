import logging
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.config import Settings, get_settings
from app.dependencies import get_current_user, require_role
from app.models.action import ActionResponse, AuthorityActionRequest, VALID_COMMITTEE_ACTIONS
from app.services.blockchain import BlockchainService, get_blockchain_service
from app.services.email import EmailService, get_email_service
from app.services.firebase import FirebaseService, get_firebase_service
from app.services.ipfs import IPFSService, get_ipfs_service

logger = logging.getLogger(__name__)
router = APIRouter()


def _notify_student(
    grievance_id: int,
    action: str,
    fb: FirebaseService,
    settings: Settings,
) -> None:
    """Push an in-app notification and queue an email to the grievance owner."""
    cache = fb.get_grievance_cache(grievance_id)
    if not cache:
        return
    student_uid = cache.get("studentUid")
    if not student_uid:
        return   # anonymous — no notification

    notif_map = {
        "resolve": ("grievance_resolved",  f"Grievance #{grievance_id} has been resolved. Please give feedback."),
        "forward": ("grievance_forwarded", f"Grievance #{grievance_id} has been escalated to the HoD."),
        "debar":   ("grievance_debarred",  f"Grievance #{grievance_id} has been reviewed and was not accepted."),
    }
    notif_type, message = notif_map.get(action, ("grievance_forwarded", f"Update on grievance #{grievance_id}."))

    fb.create_notification(uid=student_uid, grievance_id=grievance_id,
                           message=message, notif_type=notif_type)
    profile = fb.get_user_profile(student_uid)
    if profile:
        fb.enqueue_email(
            to_email=profile["email"],
            to_name=profile["displayName"],
            subject=f"Update on Grievance #{grievance_id}",
            plain_body=message,
        )


# ── Propose an action ─────────────────────────────────────────────────────────

@router.post(
    "/{grievance_id}/propose",
    response_model=ActionResponse,
    summary="Committee member proposes or votes on an action",
)
async def committee_propose(
    grievance_id:   int,
    action:         Annotated[str,  Form()],
    remarks:        Annotated[str,  Form()] = "",
    files:          list[UploadFile]         = File(default=[]),
    current_user:   dict                     = Depends(require_role("committee", "admin")),
    bc:             BlockchainService        = Depends(get_blockchain_service),
    fb:             FirebaseService          = Depends(get_firebase_service),
    ipfs:           IPFSService              = Depends(get_ipfs_service),
    settings:       Settings                 = Depends(get_settings),
) -> ActionResponse:
    """
    A committee member proposes an action (forward / resolve / debar).
    Each call counts as one vote. When yes_count > committeeSize / 2,
    call /execute to apply the action on-chain.
    """
    action = action.strip().lower()
    if action not in VALID_COMMITTEE_ACTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid action. Must be one of: {', '.join(VALID_COMMITTEE_ACTIONS)}",
        )

    # Upload remarks/docs to IPFS if provided
    remarks_cid = ""
    if remarks.strip() or files:
        attachments = []
        for f in files:
            if f.filename and f.size:
                attachments.append((f.filename, await f.read(), f.content_type or ""))
        remarks_cid = await ipfs.upload_remark(
            remarks_text=remarks,
            actor_role="committee",
            grievance_id=grievance_id,
            attachments=attachments or None,
        )

    try:
        result = await bc.committee_propose(grievance_id, action, remarks_cid)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Read updated tally to show the caller
    tally = await bc.get_committee_vote_tally(grievance_id)

    return ActionResponse(
        tx_hash=result["txHash"],
        new_status="AtCommittee",
        message=(
            f"Vote recorded. Current tally: {tally['yesCount']}/{tally['majorityNeeded']} "
            f"needed for majority. Call /execute when ready."
        ),
    )


# ── Get vote tally ────────────────────────────────────────────────────────────

@router.get(
    "/{grievance_id}/votes",
    summary="Get the current committee vote tally for a pending action",
)
async def get_votes(
    grievance_id: int,
    current_user: dict              = Depends(require_role("committee", "admin")),
    bc:           BlockchainService = Depends(get_blockchain_service),
) -> dict:
    try:
        return await bc.get_committee_vote_tally(grievance_id)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Grievance #{grievance_id} not found.")


# ── Execute pending action ────────────────────────────────────────────────────

@router.post(
    "/{grievance_id}/execute",
    response_model=ActionResponse,
    summary="Execute the committee action once majority is reached",
)
async def execute_committee_action(
    grievance_id: int,
    current_user: dict              = Depends(require_role("committee", "admin")),
    bc:           BlockchainService = Depends(get_blockchain_service),
    fb:           FirebaseService   = Depends(get_firebase_service),
    emailsv:      EmailService      = Depends(get_email_service),
    settings:     Settings          = Depends(get_settings),
) -> ActionResponse:
    """
    Executes the pending committee action when majority has been reached.
    Can be called by any committee member (or admin) once votes cross 50%.
    """
    # Read what action is pending before executing
    tally = await bc.get_committee_vote_tally(grievance_id)
    if tally["executed"]:
        raise HTTPException(status_code=400, detail="Committee action already executed.")
    if tally["yesCount"] <= tally["majorityNeeded"] - 1:
        raise HTTPException(
            status_code=400,
            detail=f"Majority not reached yet: {tally['yesCount']}/{tally['majorityNeeded']} votes.",
        )

    try:
        result = await bc.execute_committee_action(grievance_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Determine new status from the action that was executed
    action = tally["proposedAction"].lower()
    status_map = {
        "forward": "AtHoD",
        "resolve": "AwaitingFeedback",
        "debar":   "Debarred",
    }
    new_status = status_map.get(action, "AtCommittee")

    # Sync Firestore cache
    fb.upsert_grievance_cache(grievance_id, {"status": new_status})

    # Notify student
    _notify_student(grievance_id, action, fb, settings)

    # Notify next level if forwarded
    if new_status == "AtHoD":
        cache = fb.get_grievance_cache(grievance_id)
        dept  = cache.get("department", "") if cache else ""
        hod_users = (
            fb._db.collection("users")
            .where("instituteId", "==", settings.institute_id)
            .where("role", "==", "hod")
            .where("department", "==", dept)
            .stream()
        )
        for u in hod_users:
            user = u.to_dict()
            fb.create_notification(
                uid=user["uid"], grievance_id=grievance_id,
                message=f"Grievance #{grievance_id} has been escalated to you.",
                notif_type="action_required_hod",
            )
            fb.enqueue_email(
                to_email=user["email"], to_name=user.get("displayName", ""),
                subject=f"Action required: Grievance #{grievance_id}",
                plain_body=f"Grievance #{grievance_id} has been forwarded to your level.",
            )

    logger.info("Committee executed '%s' on grievance #%d → %s", action, grievance_id, new_status)

    return ActionResponse(
        tx_hash=result["txHash"],
        new_status=new_status,
        message=f"Action '{action}' executed. Grievance is now {new_status}.",
    )
