import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status

from app.config import Settings, get_settings
from app.dependencies import get_current_user
from app.models.grievance import (
    ActionHistoryItem,
    FeedbackRequest,
    GrievanceDetail,
    GrievanceListItem,
    SubmitGrievanceRequest,
    SubmitGrievanceResponse,
    VoteRequest,
)
from app.services.blockchain import BlockchainService, GrievanceStatus, get_blockchain_service
from app.services.email import EmailService, get_email_service
from app.services.firebase import FirebaseService, get_firebase_service
from app.services.ipfs import IPFSService, get_ipfs_service
from app.utils.crypto import hash_student_id, hash_student_id_hex

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _grievance_list_item(cache: dict) -> GrievanceListItem:
    """Convert a Firestore cache dict to a GrievanceListItem."""
    return GrievanceListItem(
        id=cache.get("onChainId", 0),
        title=cache.get("title", ""),
        category=cache.get("category", ""),
        department=cache.get("department", ""),
        status=cache.get("status", ""),
        is_anonymous=cache.get("isAnonymous", False),
        upvotes=cache.get("upvotes", 0),
        downvotes=cache.get("downvotes", 0),
        created_at=int(cache["createdAt"].timestamp()) if cache.get("createdAt") else 0,
        threshold_deadline=cache.get("thresholdDeadline", 0),
        student_name="" if cache.get("isAnonymous") else cache.get("studentName", ""),
    )


async def _notify_next_level(
    status: str,
    department: str,
    grievance_id: int,
    fb: FirebaseService,
    emailsv: EmailService,
    settings: Settings,
) -> None:
    """
    After a grievance moves to a new level, notify the relevant authority
    and create an in-app notification for them.
    """
    notif_type_map = {
        "AtCommittee": "action_required_committee",
        "AtHoD":       "action_required_hod",
        "AtPrincipal": "action_required_principal",
    }
    notif_type = notif_type_map.get(status)
    if not notif_type:
        return

    role_map = {
        "AtCommittee": "committee",
        "AtHoD":       "hod",
        "AtPrincipal": "principal",
    }
    target_role = role_map[status]

    # Find all users with the target role in this institute
    # (Firestore query on role field)
    try:
        users_ref = fb._db.collection("users").where(
            "instituteId", "==", settings.institute_id
        ).where("role", "==", target_role)

        if target_role in ("committee", "hod"):
            users_ref = users_ref.where("department", "==", department)

        for user_doc in users_ref.stream():
            user = user_doc.to_dict()
            fb.create_notification(
                uid=user["uid"],
                grievance_id=grievance_id,
                message=f"Grievance #{grievance_id} requires your attention.",
                notif_type=notif_type,
            )
            fb.enqueue_email(
                to_email=user["email"],
                to_name=user.get("displayName", ""),
                subject=f"Action required: Grievance #{grievance_id}",
                plain_body=(
                    f"Grievance #{grievance_id} has been escalated to your level. "
                    f"Please log in to the portal to review and take action."
                ),
            )
    except Exception as exc:
        logger.error("Failed to notify next level for grievance #%d: %s", grievance_id, exc)


# ── Submit grievance — background helpers ─────────────────────────────────────

async def _submit_blockchain_background(
    req:          SubmitGrievanceRequest,
    uid:          str,
    student_name: str,
    ipfs_cid:     str,
    attachments:  list[tuple[str, bytes, str]],
    bc:           BlockchainService,
    fb:           FirebaseService,
    emailsv:      EmailService,
    settings:     Settings,
) -> None:
    """
    Runs after the HTTP response is returned to the client.
    Submits to blockchain, writes Firestore cache, and sends notifications.
    Render's 30-second HTTP timeout does not affect background tasks.
    """
    try:
        result = await bc.submit_grievance(
            category=req.category,
            sub_category=req.sub_category,
            department=req.department,
            ipfs_cid=ipfs_cid,
            is_anonymous=req.is_anonymous,
            student_id=hash_student_id(uid),
        )
    except Exception as exc:
        logger.error("Background blockchain submit failed for uid=%s ipfs=%s: %s", uid, ipfs_cid, exc)
        return

    grievance_id = result["grievanceId"]
    tx_hash      = result["txHash"]
    now          = datetime.now(timezone.utc)

    fb.upsert_grievance_cache(grievance_id, {
        "onChainId":         grievance_id,
        "title":             req.title,
        "category":          req.category,
        "subCategory":       req.sub_category,
        "department":        req.department,
        "status":            "AtCommittee",
        "isAnonymous":       req.is_anonymous,
        "studentUid":        uid if not req.is_anonymous else None,
        "studentName":       student_name,
        "ipfsCid":           ipfs_cid,
        "upvotes":           0,
        "downvotes":         0,
        "thresholdDeadline": result.get("thresholdDeadline", 0),
        "instituteId":       settings.institute_id,
        "createdAt":         now,
        "updatedAt":         now,
        "txHash":            tx_hash,
    })

    fb.create_notification(
        uid=uid,
        grievance_id=grievance_id,
        message=f"Your grievance #{grievance_id} has been submitted successfully.",
        notif_type="grievance_submitted",
    )
    user_profile = fb.get_user_profile(uid)
    if user_profile:
        fb.enqueue_email(
            to_email=user_profile["email"],
            to_name=user_profile["displayName"],
            subject=f"Grievance #{grievance_id} submitted",
            plain_body=(
                f"Your grievance '{req.title}' (#{grievance_id}) has been submitted "
                f"and is now under review by the Grievance Committee."
            ),
        )

    await _notify_next_level("AtCommittee", req.department, grievance_id, fb, emailsv, settings)
    logger.info("Background: grievance #%d submitted by uid=%s tx=%s", grievance_id, uid, tx_hash)


# ── Submit grievance ──────────────────────────────────────────────────────────

@router.post(
    "/",
    response_model=SubmitGrievanceResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Submit a new grievance",
)
async def submit_grievance(
    background_tasks: BackgroundTasks,
    # Text fields sent as form fields alongside files
    title:        Annotated[str,  Form()],
    category:     Annotated[str,  Form()],
    department:   Annotated[str,  Form()],
    description:  Annotated[str,  Form()],
    sub_category: Annotated[str,  Form()] = "",
    is_anonymous: Annotated[bool, Form()] = False,
    files:        list[UploadFile] = File(default=[]),
    current_user: dict              = Depends(get_current_user),
    bc:           BlockchainService = Depends(get_blockchain_service),
    fb:           FirebaseService   = Depends(get_firebase_service),
    ipfs:         IPFSService       = Depends(get_ipfs_service),
    emailsv:      EmailService      = Depends(get_email_service),
    settings:     Settings          = Depends(get_settings),
) -> SubmitGrievanceResponse:
    """
    Submit a new grievance. Accepts multipart/form-data so files can be
    attached alongside the text fields.

    Flow:
      1. Validate input
      2. Read uploaded files
      3. Upload content bundle to IPFS → get CID
      4. Return 202 immediately (avoids Render's 30-second HTTP timeout)
      5. Background: submit to blockchain, write Firestore cache, send notifications
    """
    try:
        req = SubmitGrievanceRequest(
            title=title,
            category=category,
            sub_category=sub_category,
            department=department,
            description=description,
            is_anonymous=is_anonymous,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    uid = current_user["uid"]

    attachments: list[tuple[str, bytes, str]] = []
    for f in files:
        if f.filename and f.size and f.size > 0:
            content   = await f.read()
            mime_type = f.content_type or "application/octet-stream"
            attachments.append((f.filename, content, mime_type))

    try:
        ipfs_cid = await ipfs.upload_grievance_content(
            title=req.title,
            description=req.description,
            category=req.category,
            sub_category=req.sub_category,
            department=req.department,
            student_uid_hash=hash_student_id_hex(uid),
            attachments=attachments if attachments else None,
        )
    except Exception as exc:
        logger.error("IPFS upload failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"File storage unavailable: {exc}")

    student_name = "" if req.is_anonymous else current_user.get("name", "")

    background_tasks.add_task(
        _submit_blockchain_background,
        req, uid, student_name, ipfs_cid, attachments,
        bc, fb, emailsv, settings,
    )

    logger.info("Grievance queued for blockchain submission by uid=%s ipfs=%s", uid, ipfs_cid)

    return SubmitGrievanceResponse(
        ipfs_cid=ipfs_cid,
        message="Grievance accepted. It will appear in your dashboard once confirmed on-chain (usually within 1–2 minutes).",
    )


# ── List grievances ───────────────────────────────────────────────────────────

@router.get(
    "/",
    response_model=list[GrievanceListItem],
    summary="List grievances filtered by the caller's role",
)
async def list_grievances(
    status_filter: str | None = None,
    limit:         int         = 20,
    offset:        int         = 0,
    current_user:  dict              = Depends(get_current_user),
    fb:            FirebaseService   = Depends(get_firebase_service),
    settings:      Settings          = Depends(get_settings),
) -> list[GrievanceListItem]:
    """
    Returns grievances the caller is allowed to see, based on their role:

    - student    → only their own grievances (all statuses)
    - committee  → all grievances at AtCommittee for their department
    - hod        → all grievances at AtHoD for their department
    - principal  → all grievances at AtPrincipal
    - admin      → all grievances in the institute

    Reads from Firestore cache — no blockchain RPC cost.
    """
    uid        = current_user["uid"]
    role       = current_user.get("role", "student")
    profile    = fb.get_user_profile(uid)
    department = profile.get("department", "") if profile else ""

    if role == "student":
        docs = fb.list_student_grievances(uid, settings.institute_id)
    elif role == "committee":
        docs = fb.list_grievances(
            settings.institute_id,
            status="AtCommittee",
            department=department,
            limit=limit,
            offset=offset,
        )
    elif role == "hod":
        docs = fb.list_grievances(
            settings.institute_id,
            status="AtHoD",
            department=department,
            limit=limit,
            offset=offset,
        )
    elif role == "principal":
        docs = fb.list_grievances(
            settings.institute_id,
            status="AtPrincipal",
            limit=limit,
            offset=offset,
        )
    else:
        # admin sees everything
        docs = fb.list_grievances(
            settings.institute_id,
            status=status_filter,
            limit=limit,
            offset=offset,
        )

    return [_grievance_list_item(d) for d in docs]


# ── Get single grievance ──────────────────────────────────────────────────────

@router.get(
    "/{grievance_id}",
    response_model=GrievanceDetail,
    summary="Get full grievance details including on-chain action history",
)
async def get_grievance(
    grievance_id: int,
    current_user: dict              = Depends(get_current_user),
    bc:           BlockchainService = Depends(get_blockchain_service),
    fb:           FirebaseService   = Depends(get_firebase_service),
    settings:     Settings          = Depends(get_settings),
) -> GrievanceDetail:
    """
    Returns the full grievance record by merging:
    - On-chain state (status, votes, threshold)
    - Firestore cache (title, student name)
    - On-chain action history (full audit trail)
    """
    # Fetch from blockchain (source of truth for state)
    try:
        on_chain = await bc.get_grievance(grievance_id)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Grievance #{grievance_id} not found.")

    # Fetch Firestore cache for off-chain metadata
    cache = fb.get_grievance_cache(grievance_id) or {}

    # Access control: students can only see their own grievances
    uid  = current_user["uid"]
    role = current_user.get("role", "student")
    if role == "student":
        student_uid = cache.get("studentUid")
        if student_uid and student_uid != uid:
            raise HTTPException(status_code=403, detail="Access denied.")

    # Fetch full action history from chain
    history_raw = await bc.get_action_history(grievance_id)
    history = [
        ActionHistoryItem(
            grievance_id=h["grievanceId"],
            actor=h["actor"],
            action=h["action"],
            remarks_ipfs_cid=h["remarksIpfsCid"],
            timestamp=h["timestamp"],
            from_status=h["fromStatus"],
            to_status=h["toStatus"],
        )
        for h in history_raw
    ]

    # Mask student identity if anonymous
    student_name = ""
    if not on_chain["isAnonymous"] and role != "student":
        student_name = cache.get("studentName", "")

    return GrievanceDetail(
        id=on_chain["id"],
        student_identifier=on_chain["studentIdentifier"],
        is_anonymous=on_chain["isAnonymous"],
        category=on_chain["category"],
        sub_category=on_chain["subCategory"],
        department=on_chain["department"],
        ipfs_cid=on_chain["ipfsCid"],
        status=on_chain["status"],
        created_at=on_chain["createdAt"],
        updated_at=on_chain["updatedAt"],
        threshold_deadline=on_chain["thresholdDeadline"],
        upvotes=on_chain["upvotes"],
        downvotes=on_chain["downvotes"],
        title=cache.get("title", ""),
        student_name=student_name,
        action_history=history,
        tx_hash=cache.get("txHash", ""),
    )


# ── Get action history only ───────────────────────────────────────────────────

@router.get(
    "/{grievance_id}/history",
    response_model=list[ActionHistoryItem],
    summary="Get the on-chain audit trail for a grievance",
)
async def get_history(
    grievance_id: int,
    current_user: dict              = Depends(get_current_user),
    bc:           BlockchainService = Depends(get_blockchain_service),
) -> list[ActionHistoryItem]:
    """
    Returns only the action history for a grievance.
    Useful for the frontend audit trail timeline component.
    """
    try:
        history_raw = await bc.get_action_history(grievance_id)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Grievance #{grievance_id} not found.")

    return [
        ActionHistoryItem(
            grievance_id=h["grievanceId"],
            actor=h["actor"],
            action=h["action"],
            remarks_ipfs_cid=h["remarksIpfsCid"],
            timestamp=h["timestamp"],
            from_status=h["fromStatus"],
            to_status=h["toStatus"],
        )
        for h in history_raw
    ]


# ── Vote ──────────────────────────────────────────────────────────────────────

@router.post(
    "/{grievance_id}/vote",
    summary="Cast an upvote or downvote on a grievance",
)
async def vote(
    grievance_id: int,
    body:         VoteRequest,
    current_user: dict              = Depends(get_current_user),
    bc:           BlockchainService = Depends(get_blockchain_service),
    fb:           FirebaseService   = Depends(get_firebase_service),
) -> dict:
    """
    One vote per student per grievance. Enforced on-chain.
    The transaction will revert if the student has already voted.
    """
    if current_user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can vote.")

    try:
        result = await bc.cast_vote(grievance_id, body.is_upvote, hash_student_id(current_user["uid"]))
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Sync vote counts to Firestore cache
    on_chain = await bc.get_grievance(grievance_id)
    fb.upsert_grievance_cache(grievance_id, {
        "upvotes":   on_chain["upvotes"],
        "downvotes": on_chain["downvotes"],
    })

    return {"txHash": result["txHash"], "message": "Vote recorded on-chain."}


# ── Feedback ──────────────────────────────────────────────────────────────────

@router.post(
    "/{grievance_id}/feedback",
    summary="Submit satisfaction feedback after a grievance is resolved",
)
async def submit_feedback(
    grievance_id: int,
    body:         FeedbackRequest,
    current_user: dict              = Depends(get_current_user),
    bc:           BlockchainService = Depends(get_blockchain_service),
    fb:           FirebaseService   = Depends(get_firebase_service),
    ipfs:         IPFSService       = Depends(get_ipfs_service),
    settings:     Settings          = Depends(get_settings),
) -> dict:
    """
    Called by the student after receiving a resolution.
    - isSatisfied=true  → grievance moves to Closed
    - isSatisfied=false → grievance re-escalates to Committee
    """
    if current_user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can submit feedback.")

    remarks_cid = ""
    if body.remarks.strip():
        remarks_cid = await ipfs.upload_remark(
            remarks_text=body.remarks,
            actor_role="student",
            grievance_id=grievance_id,
        )

    try:
        result = await bc.submit_feedback(
            grievance_id, body.is_satisfied, remarks_cid,
            hash_student_id(current_user["uid"]),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Update Firestore cache
    new_status = "Closed" if body.is_satisfied else "AtCommittee"
    fb.upsert_grievance_cache(grievance_id, {"status": new_status})

    # Notify student
    uid      = current_user["uid"]
    notif    = "grievance_closed" if body.is_satisfied else "grievance_submitted"
    message  = (
        f"Grievance #{grievance_id} is now closed. Thank you for your feedback."
        if body.is_satisfied else
        f"Grievance #{grievance_id} has been re-submitted for further review."
    )
    fb.create_notification(uid=uid, grievance_id=grievance_id,
                           message=message, notif_type=notif)

    return {
        "txHash":  result["txHash"],
        "status":  new_status,
        "message": message,
    }
