import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import get_settings

logger    = logging.getLogger(__name__)
settings  = get_settings()
scheduler = AsyncIOScheduler()


# ── Job 1: Threshold watchdog ─────────────────────────────────────────────────

@scheduler.scheduled_job(
    "interval",
    minutes=settings.threshold_check_interval_minutes,
    id="threshold_watchdog",
)
async def threshold_watchdog() -> None:
    """
    Runs every N minutes (default: 30).

    Checks every active grievance in the Firestore cache. If any have
    passed their thresholdDeadline without an action being taken, it:
      1. Verifies the on-chain status still matches (Firestore is a cache,
         not the source of truth).
      2. Calls adminAutoForward() on the contract via the relay wallet.
      3. Logs the violation to Firestore.
      4. Sends an alert email to the institute admin.
    """
    # Late imports to avoid circular dependency at module load time
    from app.services.blockchain import get_blockchain_service
    from app.services.firebase   import get_firebase_service
    from app.services.email      import get_email_service

    bc      = get_blockchain_service()
    fb      = get_firebase_service()
    emailsv = get_email_service()

    logger.info("[Watchdog] threshold_watchdog: starting check...")

    now = datetime.now(timezone.utc)

    # Active statuses that have a threshold
    active_statuses = ["AtCommittee", "AtHoD", "AtPrincipal"]

    try:
        # Query Firestore cache for potentially overdue grievances
        institute_id = settings.institute_id
        all_active   = fb.list_grievances(
            institute_id=institute_id,
            limit=200,   # handle up to 200 active grievances per run
        )

        overdue = [
            g for g in all_active
            if g.get("status") in active_statuses
            and g.get("thresholdDeadline") is not None
            and _to_utc(g["thresholdDeadline"]) < now
        ]

        if not overdue:
            logger.info("[Watchdog] No overdue grievances found.")
            return

        logger.warning("[Watchdog] Found %d overdue grievance(s).", len(overdue))

        for g in overdue:
            grievance_id = g.get("onChainId")
            if grievance_id is None:
                continue

            try:
                # Verify on-chain status still matches the cache — avoid
                # double-forwarding if Firestore cache hasn't been updated yet
                on_chain = await bc.get_grievance(grievance_id)
                if on_chain["status"] != g["status"]:
                    logger.info(
                        "[Watchdog] Grievance #%d already moved to %s on-chain — skipping.",
                        grievance_id, on_chain["status"],
                    )
                    continue

                # Trigger auto-forward on-chain
                result = await bc.admin_auto_forward(grievance_id)
                logger.warning(
                    "[Watchdog] Auto-forwarded grievance #%d (tx: %s)",
                    grievance_id, result["txHash"],
                )

                # Log the violation to Firestore
                fb.log_threshold_violation(
                    grievance_id=grievance_id,
                    level=g["status"],
                    institute_id=institute_id,
                )

                # Alert the admin via email
                institute = fb.get_institute(institute_id)
                if institute:
                    admin_uid = institute.get("adminUid")
                    if admin_uid:
                        admin_profile = fb.get_user_profile(admin_uid)
                        if admin_profile:
                            await emailsv.send_admin_threshold_alert(
                                admin_email=admin_profile["email"],
                                admin_name=admin_profile["displayName"],
                                grievance_id=grievance_id,
                                level=g["status"],
                            )

            except Exception as exc:
                # Log but don't crash the whole job — continue with remaining grievances
                logger.error(
                    "[Watchdog] Failed to auto-forward grievance #%d: %s",
                    grievance_id, exc,
                )

    except Exception as exc:
        logger.error("[Watchdog] Job failed: %s", exc)

    logger.info("[Watchdog] threshold_watchdog: done.")


# ── Job 2: Email queue processor ─────────────────────────────────────────────

@scheduler.scheduled_job(
    "interval",
    minutes=1,
    id="email_queue_processor",
)
async def email_queue_processor() -> None:
    """
    Runs every minute.
    Reads up to 20 unsent items from the Firestore email_queue collection
    and dispatches them via SendGrid, then marks each as sent.

    Using Firestore as the queue (instead of Redis) keeps the stack free.
    """
    from app.services.firebase import get_firebase_service
    from app.services.email    import get_email_service

    fb      = get_firebase_service()
    emailsv = get_email_service()

    pending = fb.get_pending_emails(batch_size=20)
    if not pending:
        return

    logger.info("[EmailQueue] Processing %d email(s)...", len(pending))

    for doc_id, data in pending:
        try:
            await emailsv.send_queued_email(
                to_email=data["toEmail"],
                to_name=data.get("toName", ""),
                subject=data["subject"],
                plain_body=data.get("plainBody", ""),
                template_data=data.get("templateData", {}),
            )
            fb.mark_email_sent(doc_id)
        except Exception as exc:
            logger.error("[EmailQueue] Failed to send doc %s: %s", doc_id, exc)


# ── Lifecycle helpers ─────────────────────────────────────────────────────────

def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.start()
        logger.info("[Scheduler] APScheduler started.")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[Scheduler] APScheduler stopped.")


# ── Utility ───────────────────────────────────────────────────────────────────

def _to_utc(value) -> datetime:
    """
    Normalise a Firestore timestamp or Python datetime to UTC-aware datetime.
    Firestore returns google.cloud.firestore_v1.base_document.DatetimeWithNanoseconds
    which is already timezone-aware.
    """
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    # Firestore Timestamp object
    return value.astimezone(timezone.utc)
