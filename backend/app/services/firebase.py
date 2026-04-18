import logging
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

import firebase_admin
from firebase_admin import auth, credentials, firestore

from app.config import get_settings

logger = logging.getLogger(__name__)


def _init_firebase_app() -> firebase_admin.App:
    """
    Initialise Firebase Admin SDK once. Safe to call multiple times —
    returns the existing app if already initialised.
    """
    if firebase_admin._apps:
        return firebase_admin.get_app()

    settings = get_settings()
    cred = credentials.Certificate(settings.firebase_credentials_dict)
    return firebase_admin.initialize_app(cred)


class FirebaseService:
    """
    Wraps all Firebase Admin SDK interactions:
      - Token verification (auth)
      - Firestore reads / writes (user profiles, grievance cache, notifications)
      - Custom claims (role management)
    """

    def __init__(self) -> None:
        _init_firebase_app()
        self._db = firestore.client()
        self._settings = get_settings()

    # ── Auth ──────────────────────────────────────────────────────────────────

    def verify_token(self, id_token: str) -> dict | None:
        """
        Verify a Firebase ID token from the frontend.
        Returns the decoded token dict on success, None on failure.
        The dict includes: uid, email, role (custom claim), institute_id (custom claim).
        """
        try:
            decoded = auth.verify_id_token(id_token)
            return decoded
        except Exception as exc:
            logger.warning("Token verification failed: %s", exc)
            return None

    def get_user(self, uid: str) -> auth.UserRecord | None:
        """Fetch a Firebase Auth user record by UID."""
        try:
            return auth.get_user(uid)
        except auth.UserNotFoundError:
            return None

    def get_user_by_email(self, email: str) -> auth.UserRecord | None:
        """Fetch a Firebase Auth user record by email."""
        try:
            return auth.get_user_by_email(email)
        except auth.UserNotFoundError:
            return None

    def set_user_role(self, uid: str, role: str, institute_id: str) -> None:
        """
        Set Firebase custom claims for a user.
        These are embedded in the ID token and read by get_current_user().
        The frontend must refresh its token after this call for changes to take effect.
        """
        auth.set_custom_user_claims(uid, {
            "role": role,
            "institute_id": institute_id,
        })
        logger.info("Set role=%s for uid=%s", role, uid)

    def revoke_user_tokens(self, uid: str) -> None:
        """
        Revoke all existing tokens for a user.
        Call this after revoking a role so the old token (with old claims) stops working.
        """
        auth.revoke_refresh_tokens(uid)

    # ── User profiles (Firestore: /users/{uid}) ───────────────────────────────

    def create_user_profile(
        self,
        uid: str,
        display_name: str,
        email: str,
        role: str,
        department: str,
        institute_id: str,
        wallet_address: str = "",
    ) -> None:
        """Create or overwrite a user profile document in Firestore."""
        self._db.collection("users").document(uid).set({
            "uid":            uid,
            "displayName":    display_name,
            "email":          email,
            "role":           role,
            "department":     department,
            "instituteId":    institute_id,
            "walletAddress":  wallet_address,
            "createdAt":      datetime.now(timezone.utc),
        })

    def get_user_profile(self, uid: str) -> dict | None:
        """Return a user profile dict, or None if not found."""
        try:
            doc = self._db.collection("users").document(uid).get()
            return doc.to_dict() if doc.exists else None
        except Exception as exc:
            logger.error("get_user_profile failed for uid=%s: %s", uid, exc)
            return None

    def update_user_profile(self, uid: str, updates: dict) -> None:
        """Partial update of a user profile."""
        self._db.collection("users").document(uid).update(updates)

    # ── Grievance cache (Firestore: /grievances/{grievanceId}) ────────────────
    # The on-chain contract is the source of truth.
    # Firestore holds a cache for fast listing/filtering without RPC calls.

    def upsert_grievance_cache(self, grievance_id: int, data: dict) -> None:
        """
        Write or update the Firestore cache entry for a grievance.
        Called by the backend every time the on-chain state changes.
        """
        doc_id = str(grievance_id)
        data["updatedAt"] = datetime.now(timezone.utc)
        self._db.collection("grievances").document(doc_id).set(data, merge=True)

    def get_grievance_cache(self, grievance_id: int) -> dict | None:
        doc = self._db.collection("grievances").document(str(grievance_id)).get()
        return doc.to_dict() if doc.exists else None

    def list_grievances(
        self,
        institute_id: str,
        status: str | None = None,
        department: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict]:
        """
        List grievances from the Firestore cache with optional filters.
        Returns dicts ordered by updatedAt descending.
        """
        query = (
            self._db.collection("grievances")
            .where("instituteId", "==", institute_id)
            .order_by("updatedAt", direction=firestore.Query.DESCENDING)
        )
        if status:
            query = query.where("status", "==", status)
        if department:
            query = query.where("department", "==", department)

        docs = query.limit(limit).offset(offset).stream()
        return [d.to_dict() for d in docs]

    def list_student_grievances(self, student_uid: str, institute_id: str) -> list[dict]:
        """List all grievances submitted by a specific student."""
        try:
            docs = (
                self._db.collection("grievances")
                .where("studentUid", "==", student_uid)
                .order_by("createdAt", direction=firestore.Query.DESCENDING)
                .stream()
            )
            return [d.to_dict() for d in docs]
        except Exception as exc:
            logger.error("list_student_grievances failed: %s", exc)
            return []

    # ── Notifications (Firestore: /notifications/{uid}/items/{notifId}) ───────

    def create_notification(
        self,
        uid: str,
        grievance_id: int,
        message: str,
        notif_type: str,
    ) -> None:
        """
        Push a notification to a user's notification feed.
        The frontend listens to this subcollection in real time.
        """
        self._db.collection("notifications").document(uid).collection("items").add({
            "grievanceId": grievance_id,
            "message":     message,
            "type":        notif_type,   # e.g. "action_taken", "threshold_warning"
            "isRead":      False,
            "createdAt":   datetime.now(timezone.utc),
        })

    def mark_notification_read(self, uid: str, notif_id: str) -> None:
        (
            self._db.collection("notifications")
            .document(uid)
            .collection("items")
            .document(notif_id)
            .update({"isRead": True})
        )

    # ── Email queue (Firestore: /email_queue/{docId}) ─────────────────────────
    # APScheduler polls this collection every minute and dispatches via SendGrid.

    def enqueue_email(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        template_data: dict,
        template_id: str = "",
        plain_body: str = "",
    ) -> None:
        """Add an email task to the Firestore queue."""
        self._db.collection("email_queue").add({
            "toEmail":      to_email,
            "toName":       to_name,
            "subject":      subject,
            "templateId":   template_id,
            "templateData": template_data,
            "plainBody":    plain_body,
            "sent":         False,
            "createdAt":    datetime.now(timezone.utc),
        })

    def get_pending_emails(self, batch_size: int = 20) -> list[tuple[str, dict]]:
        """
        Returns up to batch_size unsent emails as (doc_id, data) tuples.
        Called by the APScheduler email_queue_processor job.
        """
        docs = (
            self._db.collection("email_queue")
            .where("sent", "==", False)
            .order_by("createdAt")
            .limit(batch_size)
            .stream()
        )
        return [(d.id, d.to_dict()) for d in docs]

    def mark_email_sent(self, doc_id: str) -> None:
        self._db.collection("email_queue").document(doc_id).update({
            "sent":   True,
            "sentAt": datetime.now(timezone.utc),
        })

    # ── Institute config (Firestore: /institutes/{instituteId}) ───────────────

    def get_institute(self, institute_id: str) -> dict | None:
        doc = self._db.collection("institutes").document(institute_id).get()
        return doc.to_dict() if doc.exists else None

    def update_institute(self, institute_id: str, updates: dict) -> None:
        self._db.collection("institutes").document(institute_id).set(updates, merge=True)

    # ── Threshold violation log (Firestore: /threshold_violations/{docId}) ────

    def log_threshold_violation(
        self,
        grievance_id: int,
        level: str,
        institute_id: str,
    ) -> None:
        """
        Logged by the APScheduler watchdog when a threshold is exceeded and
        adminAutoForward() is triggered. Useful for admin audit reports.
        """
        self._db.collection("threshold_violations").add({
            "grievanceId":  grievance_id,
            "level":        level,
            "instituteId":  institute_id,
            "triggeredAt":  datetime.now(timezone.utc),
        })

    # ── Analytics helpers ─────────────────────────────────────────────────────

    def get_grievance_counts(self, institute_id: str) -> dict[str, int]:
        """
        Returns counts by status for the analytics dashboard.
        Reads from the Firestore cache — no RPC cost.
        """
        statuses = [
            "AtCommittee", "AtHoD", "AtPrincipal",
            "AwaitingFeedback", "Closed", "Debarred",
        ]
        counts: dict[str, int] = {}
        for status in statuses:
            docs = (
                self._db.collection("grievances")
                .where("instituteId", "==", institute_id)
                .where("status", "==", status)
                .count()
                .get()
            )
            counts[status] = docs[0][0].value
        return counts

    def get_grievances_by_department(self, institute_id: str) -> list[dict]:
        """Returns per-department grievance counts for the analytics chart."""
        docs = (
            self._db.collection("grievances")
            .where("instituteId", "==", institute_id)
            .stream()
        )
        dept_counts: dict[str, Any] = {}
        for doc in docs:
            data = doc.to_dict()
            dept = data.get("department", "Unknown")
            if dept not in dept_counts:
                dept_counts[dept] = {"department": dept, "total": 0, "resolved": 0}
            dept_counts[dept]["total"] += 1
            if data.get("status") == "Closed":
                dept_counts[dept]["resolved"] += 1
        return list(dept_counts.values())


# ── Singleton accessor ────────────────────────────────────────────────────────

@lru_cache
def get_firebase_service() -> FirebaseService:
    """
    Returns a cached FirebaseService instance.
    Use as a FastAPI dependency: firebase = Depends(get_firebase_service)
    """
    return FirebaseService()
