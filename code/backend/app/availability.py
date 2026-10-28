from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Reservation, ReservationItem


def busiest_moment(lines, start: datetime) -> int:
    """Returns the highest number of one item that is out at the same time during the period.

    The number in use only goes up at the start of the period or when a reservation starts,
    so checking those moments is enough to find the peak.
    """
    moments = [start] + [line.start for line in lines if line.start > start]
    return max(sum(line.count for line in lines if line.start <= moment < line.end) for moment in moments)


def reserved_per_item(
    db: Session, start: datetime, end: datetime, exclude_reservation_id: int | None = None
) -> dict[int, int]:
    """Returns per item how many are already taken at the busiest moment of the period.

    A reservation that is being changed is left out, so its own items count as free.
    The part of the period that has already passed is skipped: items that were out then but
    have been given back since are free now, even when the period starts earlier today.
    """
    start = max(start, datetime.now())
    if start >= end:
        return {}
    # Every line of every reservation that overlaps the period: which item, how many, from when to when
    query = (
        select(
            ReservationItem.item_id,
            ReservationItem.count,
            (Reservation.start_date + Reservation.start_time).label("start"),
            (Reservation.end_date + Reservation.end_time).label("end"),
        )
        .join(Reservation)
        .where(
            Reservation.start_date + Reservation.start_time < end,
            Reservation.end_date + Reservation.end_time > start,
        )
    )
    if exclude_reservation_id is not None:
        query = query.where(Reservation.reservation_id != exclude_reservation_id)
    lines = db.execute(query).all()

    item_ids = {line.item_id for line in lines}
    return {
        item_id: busiest_moment([line for line in lines if line.item_id == item_id], start) for item_id in item_ids
    }
