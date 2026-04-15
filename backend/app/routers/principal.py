import logging
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.config import Settings, get_settings
from app.dependencies import require_role
from app.models.action import ActionResponse, VALID_PRINCIPAL_ACTIONS
from app.services.blockchain import BlockchainService, get_blockchain_service
from app.services.firebase import FirebaseService, get_firebase_service
from app.services.ipfs import IPFSService, get_ipfs_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/{grievance_id}/action",
    response_model=ActionResponse,
    summary="Principal takes an action on a grievance at the Principal level",
)
async def principal_action(
    grievance_id: int,
    action:       Annotated[str,  Form()],
    remarks:      Annotated[str,  Form()] = "",
    files:        list[UploadFile]         = File(default=[]),
    current_user: dict                     = Depends(require_role("principal", "admin")),
    bc:           BlockchainService        = Depends(get_blockchain_service),
    fb:           FirebaseService          = Depends(get_firebase_service),
    ipfs:         IPFSService              = Depends(get_ipfs_service),
    settings:     Settings                 = Depends(get_settings),
) -> ActionResponse:
    """
    Principal actions: resolve (→ AwaitingFeedback) | revert (→ HoD)
    """
    action = action.strip().lower()
    if action not in VALID_PRINCIPAL_ACTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid action. Must be one of: {', '.join(VALID_PRINCIPAL_ACTIONS)}",
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
            actor_role="principal",
            grievance_id=grievance_id,
            attachments=attachments or None,
        )

    try:
        result = await bc.principal_action(grievance_id, action, remarks_cid)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    status_map = {
        "resolve": "AwaitingFeedback",
        "revert":  "AtHoD",
    }
    new_status = status_map[action]

    # Sync Firestore cache
    fb.upsert_grievance_cache(grievance_id, {"status": new_status})

    # Notify student
    cache       = fb.get_grievance_cache(grievance_id)
    student_uid = cache.get("studentUid") if cache else None
    if student_uid:
        notif_map = {
            "resolve": ("grievance_resolved", f"Grievance #{grievance_id} has been resolved by the Principal. Please give feedback."),
            "revert":  ("grievance_reverted", f"Grievance #{grievance_id} has been sent back to the HoD for review."),
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

    # If reverted to HoD, notify HoD
    if new_status == "AtHoD":
        dept     = cache.get("department", "") if cache else ""
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
                message=f"Grievance #{grievance_id} has been reverted to you by the Principal.",
                notif_type="action_required_hod",
            )
            fb.enqueue_email(
                to_email=user["email"], to_name=user.get("displayName", ""),
                subject=f"Grievance #{grievance_id} returned to you",
                plain_body=f"Grievance #{grievance_id} has been reverted by the Principal for further review.",
            )

    logger.info("Principal executed '%s' on grievance #%d → %s", action, grievance_id, new_status)

    return ActionResponse(
        tx_hash=result["txHash"],
        new_status=new_status,
        message=f"Action '{action}' recorded. Grievance is now {new_status}.",
    )
