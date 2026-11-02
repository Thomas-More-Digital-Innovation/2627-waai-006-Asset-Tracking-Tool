import asyncio
import logging
import os
from datetime import datetime, timedelta

import requests
from sqlalchemy import select

from .database import SessionLocal
from .models import Reservation
from .sso import APP_URL, client

logger = logging.getLogger("uvicorn.error")

# The mailbox in the tenant the reminders are sent from, without it no reminders are sent
MAIL_SENDER = os.environ.get("MAIL_SENDER", "").strip()
# How many hours after the end of a reservation the reminder is sent
REMINDER_DELAY = timedelta(hours=float(os.environ.get("REMINDER_AFTER_HOURS") or 4))


def send_mail(to: str, subject: str, body: str) -> None:
    """Sends a mail through Microsoft Graph, which needs the application permission Mail.Send."""
    token = client().acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
    if "access_token" not in token:
        raise RuntimeError(token.get("error_description"))
    response = requests.post(
        f"https://graph.microsoft.com/v1.0/users/{MAIL_SENDER}/sendMail",
        headers={"Authorization": f"Bearer {token['access_token']}"},
        json={
            "message": {
                "subject": subject,
                "body": {"contentType": "Text", "content": body},
                "toRecipients": [{"emailAddress": {"address": to}}],
            }
        },
        timeout=30,
    )
    response.raise_for_status()


def send_reminders(since: datetime, until: datetime) -> None:
    """Mails everyone whose items are not back and whose reservation ended REMINDER_DELAY ago, between since and until."""
    with SessionLocal() as db:
        end = Reservation.end_date + Reservation.end_time
        reservations = db.scalars(
            select(Reservation).where(
                Reservation.returned_at.is_(None),
                end > since - REMINDER_DELAY,
                end <= until - REMINDER_DELAY,
            )
        ).all()
        for reservation in reservations:
            items = "\n".join(f"- {line.count}x {line.item.name}" for line in reservation.reservation_items)
            body = (
                f"Beste {reservation.user.firstname},\n\n"
                f"Je reservering liep tot {reservation.end_date:%d/%m/%Y} om {reservation.end_time:%H:%M}, "
                f"maar deze spullen zijn nog niet terug:\n\n{items}\n\n"
                f"Wil je ze zo snel mogelijk terugbrengen?\n\n{APP_URL}\n"
            )
            try:
                send_mail(reservation.user.email, "Herinnering: spullen terugbrengen", body)
            except Exception as exception:
                logger.warning("Reminder for reservation %s not sent: %s", reservation.reservation_id, exception)


async def run_reminders() -> None:
    """Checks every 5 minutes, in a thread so the requests to the backend do not wait.

    Each check only covers the time since the last one, so every reservation gets one reminder
    without saving that in the database. Deadlines that pass while the backend is down get no reminder.
    """
    since = datetime.now()
    while True:
        await asyncio.sleep(5 * 60)
        until = datetime.now()
        try:
            await asyncio.to_thread(send_reminders, since, until)
        except Exception:
            logger.exception("Sending the reminders failed")
        since = until
