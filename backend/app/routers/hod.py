import logging
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.config import Settings, get_settings
from app.dependencies import require_role
from app.models.action import ActionResponse, VALID_HOD_ACTIONS
from app.services.blockchain import BlockchainService, get_blockchain_service
from app.services.firebase import FirebaseService, get_firebase_service
from app.services.ipfs import IPFSService, get_ipfs_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/{grievance_id}/action",
    response_model=ActionResponse,
    summary="HoD takes an action on a grievance at the HoD level",
)
async def hod_action(
    grievance_id: int,
    action:       Annotated[str,  Form()],
    remarks:      Annotated[str,  Form()] = "",
    files:        list[UploadFile]         = File(default=[]),
    current_user: dict                     = Depends(require_role("hod", "admin")),
    bc:           BlockchainService        = Depends(get_blockchain_service),
    fb:           FirebaseService          = Depends(get_firebase_service),
    ipfs:         IPFSService              = Depends(get_ipfs_service),
    settings:     Settings                 = Depends(get_settings),
) -> ActionResponse:
    """
    HoD actions: forward (→ Principal) | revert (→ Committee) | resolve (→ AwaitingFeedback)
    """
    action = action.strip().lower()
    if action not in VALID_HOD_ACTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid action. Must be one of: {', '.join(VALID_HOD_ACTIONS)}",
        )

    # Upload remarks to IPFS
    remarks_cid = ""
    if remarks.strip() or files:
        attachments = []
        for f in files:
            if f.filename and f.size:
                attachments.append((f.filename, await f.read(), f.content_type or ""))
        remarks_cid = await ipfs.upload_remark(
            remarks_text=remarks,
            actor_role="hod",
            grievance_id=grievance_id,
            attachments=attachments or None,
        )

    try:
        result = await bc.hod_action(grievance_id, action, remarks_cid)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    status_map = {
        "forward": "AtPrincipal",
        "revert":  "AtCommittee",
        "resolve": "AwaitingFeedback",
    }
    new_status = status_map[action]

    # Sync Firestore cache
    fb.upsert_grievance_cache(grievance_id, {"status": new_status})

    # Notify student
    cache       = fb.get_grievance_cache(grievance_id)
    student_uid = cache.get("studentUid") if cache else None
    if student_uid:
        notif_map = {
            "forward": ("grievance_forwarded", f"Grievance #{grievance_id} has been escalated to the Principal."),
            "revert":  ("grievance_reverted",  f"Grievance #{grievance_id} has been sent back to the Committee."),
            "resolve": ("grievance_resolved",  f"Grievance #{grievance_id} has been resolved. Please give feedback."),
        }
        notif_type, message = notif_map[action]
        fb.create_notification(uid=student_uid, grievance_id=grievance_id,
                               message=message, notif_type=notif_type)
        profile = fb.get_user_profile(student_uid)
        if profile:
            fb.enqueue_email(
                to_email=profile["email"], to_name=profile["displayName"],
                subject=f"Update on Grievance #{grievance_id}",
                plain_body=message,
            )

    # Notify next level if forwarded to Principal
    if new_status == "AtPrincipal":
        principal_users = (
            fb._db.collection("users")
            .where("instituteId", "==", settings.institute_id)
            .where("role", "==", "principal")
            .stream()
        )
        for u in principal_users:
            user = u.to_dict()
            fb.create_notification(
                uid=user["uid"], grievance_id=grievance_id,
                message=f"Grievance #{grievance_id} has been escalated to you.",
                notif_type="action_required_principal",
            )
            fb.enqueue_email(
                to_email=user["email"], to_name=user.get("displayName", ""),
                subject=f"Action required: Grievance #{grievance_id}",
                plain_body=f"Grievance #{grievance_id} requires your attention.",
            )

    logger.info("HoD executed '%s' on grievance #%d → %s", action, grievance_id, new_status)

    return ActionResponse(
        tx_hash=result["txHash"],
        new_status=new_status,
        message=f"Action '{action}' recorded. Grievance is now {new_status}.",
    )
