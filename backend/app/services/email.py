import logging
from functools import lru_cache

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send"

# Notification types → human-readable subjects
SUBJECTS = {
    "grievance_submitted":       "Your grievance has been submitted",
    "grievance_forwarded":       "Your grievance has been escalated",
    "grievance_reverted":        "Your grievance has been sent back for review",
    "grievance_resolved":        "Your grievance has been resolved — please give feedback",
    "grievance_debarred":        "Update on your grievance",
    "grievance_closed":          "Your grievance has been closed",
    "threshold_warning_admin":   "[Admin Alert] Grievance threshold exceeded",
    "action_required_committee": "Action required: grievance awaiting your review",
    "action_required_hod":       "Action required: grievance escalated to you",
    "action_required_principal": "Action required: grievance escalated to you",
}


class EmailService:
    """
    Sends transactional emails via the SendGrid v3 API.

    All calls are async (httpx). The APScheduler email_queue_processor job
    calls send_queued_email() for each pending item in Firestore.
    Direct calls (e.g. immediate notification on grievance submit) use
    send_notification() directly.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._api_key    = settings.sendgrid_api_key
        self._from_email = settings.sendgrid_from_email
        self._from_name  = settings.sendgrid_from_name

    def _build_body(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        html_body: str,
        plain_body: str = "",
    ) -> dict:
        return {
            "personalizations": [{"to": [{"email": to_email, "name": to_name}]}],
            "from":    {"email": self._from_email, "name": self._from_name},
            "subject": subject,
            "content": [
                {"type": "text/plain", "value": plain_body or _strip_html(html_body)},
                {"type": "text/html",  "value": html_body},
            ],
        }

    async def _send(self, body: dict) -> None:
        if not self._api_key:
            logger.warning("SendGrid API key not set — email not sent: %s", body.get("subject"))
            return
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                SENDGRID_API_URL,
                json=body,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type":  "application/json",
                },
            )
            if resp.status_code not in (200, 202):
                logger.error(
                    "SendGrid error %s: %s", resp.status_code, resp.text
                )
                resp.raise_for_status()
            logger.info("Email sent to %s: %s", body["personalizations"][0]["to"][0]["email"], body["subject"])

    # ── Notification templates ────────────────────────────────────────────────

    async def send_notification(
        self,
        to_email: str,
        to_name: str,
        notif_type: str,
        grievance_id: int,
        extra: dict | None = None,
    ) -> None:
        """
        Send a pre-defined notification email.
        extra dict can contain: remarks, department, level, portal_url.
        """
        extra        = extra or {}
        subject      = SUBJECTS.get(notif_type, "Update on your grievance")
        portal_url   = extra.get("portal_url", "#")
        remarks      = extra.get("remarks", "")

        html_body = _render_notification(
            to_name=to_name,
            notif_type=notif_type,
            grievance_id=grievance_id,
            remarks=remarks,
            portal_url=portal_url,
        )

        body = self._build_body(to_email, to_name, subject, html_body)
        await self._send(body)

    async def send_queued_email(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        plain_body: str,
        template_data: dict | None = None,
    ) -> None:
        """
        Send an email from the Firestore email_queue collection.
        Called by APScheduler's email_queue_processor job.
        """
        html_body = _render_plain_as_html(plain_body)
        body      = self._build_body(to_email, to_name, subject, html_body, plain_body)
        await self._send(body)

    async def send_admin_threshold_alert(
        self,
        admin_email: str,
        admin_name: str,
        grievance_id: int,
        level: str,
    ) -> None:
        """Alert the institute admin that a threshold was exceeded."""
        subject   = SUBJECTS["threshold_warning_admin"]
        html_body = f"""
        <p>Hi {admin_name},</p>
        <p>Grievance <strong>#{grievance_id}</strong> has exceeded its time threshold
        at the <strong>{level}</strong> level without any action taken.</p>
        <p>The grievance has been automatically escalated to the next level.</p>
        <p>Please review the system to ensure authorities are responding in time.</p>
        """
        body = self._build_body(admin_email, admin_name, subject, html_body)
        await self._send(body)


# ── Simple HTML helpers ───────────────────────────────────────────────────────

def _strip_html(html: str) -> str:
    """Very basic HTML tag stripper for plain-text fallback."""
    import re
    return re.sub(r"<[^>]+>", "", html).strip()


def _render_plain_as_html(text: str) -> str:
    lines = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f"<p>{lines.replace(chr(10), '<br>')}</p>"


def _render_notification(
    to_name: str,
    notif_type: str,
    grievance_id: int,
    remarks: str,
    portal_url: str,
) -> str:
    """Minimal HTML email body for grievance notifications."""
    messages = {
        "grievance_submitted": (
            f"Your grievance <strong>#{grievance_id}</strong> has been submitted "
            "and is now under review by the Grievance Committee."
        ),
        "grievance_forwarded": (
            f"Your grievance <strong>#{grievance_id}</strong> has been escalated "
            "to the next authority level for review."
        ),
        "grievance_reverted": (
            f"Your grievance <strong>#{grievance_id}</strong> has been sent back "
            "to the previous level for further review."
        ),
        "grievance_resolved": (
            f"Your grievance <strong>#{grievance_id}</strong> has been resolved. "
            "Please log in to the portal to view the resolution and submit your feedback."
        ),
        "grievance_debarred": (
            f"Your grievance <strong>#{grievance_id}</strong> has been reviewed "
            "by the committee and was not accepted for further processing."
        ),
        "grievance_closed": (
            f"Your grievance <strong>#{grievance_id}</strong> is now closed. "
            "Thank you for using the grievance portal."
        ),
        "action_required_committee": (
            f"Grievance <strong>#{grievance_id}</strong> is awaiting action from "
            "the Grievance Committee. Please log in to review."
        ),
        "action_required_hod": (
            f"Grievance <strong>#{grievance_id}</strong> has been escalated to you. "
            "Please log in to review and take action."
        ),
        "action_required_principal": (
            f"Grievance <strong>#{grievance_id}</strong> has been escalated to you. "
            "Please log in to review and take action."
        ),
    }

    message    = messages.get(notif_type, f"There is an update on grievance #{grievance_id}.")
    remarks_html = (
        f"<p><strong>Remarks:</strong> {remarks}</p>" if remarks else ""
    )

    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #2c3e50;">Grievance Redressal System</h2>
      <p>Dear {to_name},</p>
      <p>{message}</p>
      {remarks_html}
      <p>
        <a href="{portal_url}"
           style="background:#2c3e50;color:#fff;padding:10px 20px;
                  text-decoration:none;border-radius:4px;display:inline-block;">
          View on Portal
        </a>
      </p>
      <hr style="margin-top:40px;">
      <p style="font-size:12px;color:#999;">
        This is an automated notification from the Grievance Redressal System.
      </p>
    </div>
    """


# ── Singleton accessor ────────────────────────────────────────────────────────

@lru_cache
def get_email_service() -> EmailService:
    """
    Returns a cached EmailService instance.
    Use as a FastAPI dependency: email = Depends(get_email_service)
    """
    return EmailService()
