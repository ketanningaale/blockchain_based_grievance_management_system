import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import get_settings

logger    = logging.getLogger(__name__)
settings  = get_settings()
scheduler = AsyncIOScheduler()


# ── Job definitions ───────────────────────────────────────────────────────────

@scheduler.scheduled_job(
    "interval",
    minutes=settings.threshold_check_interval_minutes,
    id="threshold_watchdog",
)
async def threshold_watchdog() -> None:
    """
    Runs every N minutes (default: 30).
    Fetches active grievances from Firestore, checks whether any have exceeded
    their threshold deadline without action, and triggers adminAutoForward()
    via the relay wallet for each overdue grievance.

    Full implementation added in Step 13 once BlockchainService and
    FirebaseService are complete.
    """
    logger.info("[Scheduler] threshold_watchdog: running check...")
    # TODO: implement in Step 13
    logger.info("[Scheduler] threshold_watchdog: done.")


@scheduler.scheduled_job(
    "interval",
    minutes=1,
    id="email_queue_processor",
)
async def email_queue_processor() -> None:
    """
    Runs every minute.
    Reads pending items from the Firestore 'email_queue' collection and
    dispatches them via SendGrid, then marks them as sent.

    Full implementation added in Step 13.
    """
    # TODO: implement in Step 13
    pass


# ── Lifecycle helpers called from app/main.py ─────────────────────────────────

def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.start()
        logger.info("[Scheduler] APScheduler started.")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[Scheduler] APScheduler stopped.")
