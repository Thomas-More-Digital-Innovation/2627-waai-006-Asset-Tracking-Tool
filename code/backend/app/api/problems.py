from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..availability import broken_per_item, reserved_per_item
from ..dependencies import DbSession, get_admin_user
from ..models import Item, ItemProblem, Reservation, ReservationItem

router = APIRouter(prefix="/problems", tags=["problems"], dependencies=[Depends(get_admin_user)])


class ProblemNote(BaseModel):
    item_problem_id: int
    note: str


class NextBooking(BaseModel):
    start_date: date
    start_time: time
    department_name: str | None
    count: int
    # How many whole pieces are left for this reservation, when it is less than count the booking is in trouble
    available: int


class ItemWithProblems(BaseModel):
    item_id: int
    name: str
    article_number: str | None
    is_active: bool
    problems: list[ProblemNote]
    # The first reservation that has yet to start and needs this item, so the admin knows when it must be fixed
    next_booking: NextBooking | None


def next_bookings(db: Session, item_ids: set[int]) -> dict[int, NextBooking]:
    """Returns per item the first reservation that starts after now and contains the item."""
    start = Reservation.start_date + Reservation.start_time
    lines = db.scalars(
        select(ReservationItem)
        .join(ReservationItem.reservation)
        .where(ReservationItem.item_id.in_(item_ids), start > datetime.now())
        .order_by(start)
        .options(selectinload(ReservationItem.reservation).selectinload(Reservation.department))
    ).all()
    broken = broken_per_item(db)
    result: dict[int, NextBooking] = {}
    for line in lines:
        # The lines are ordered by start, so the first one per item is the next booking
        if line.item_id not in result:
            reservation = line.reservation
            # The other reservations in the same period take pieces too
            reserved = reserved_per_item(
                db,
                datetime.combine(reservation.start_date, reservation.start_time),
                datetime.combine(reservation.end_date, reservation.end_time),
                reservation.reservation_id,
            )
            result[line.item_id] = NextBooking(
                start_date=reservation.start_date,
                start_time=reservation.start_time,
                department_name=reservation.department.name if reservation.department else None,
                count=line.count,
                available=max(
                    line.item.count - broken.get(line.item_id, 0) - reserved.get(line.item_id, 0), 0
                ),
            )
    return result


@router.get("", response_model=list[ItemWithProblems])
def list_problems(db: DbSession):
    """Lists every item that has reported problems, with its problems, newest problem first."""
    problems = db.scalars(
        select(ItemProblem).join(ItemProblem.item).order_by(Item.name, ItemProblem.item_problem_id.desc())
    ).all()
    result: dict[int, ItemWithProblems] = {}
    for problem in problems:
        item = problem.item
        if item.item_id not in result:
            result[item.item_id] = ItemWithProblems(
                item_id=item.item_id,
                name=item.name,
                article_number=item.article_number,
                is_active=item.is_active,
                problems=[],
                next_booking=None,
            )
        result[item.item_id].problems.append(ProblemNote(item_problem_id=problem.item_problem_id, note=problem.note))
    bookings = next_bookings(db, set(result))
    for item_id, item in result.items():
        item.next_booking = bookings.get(item_id)
    return list(result.values())


@router.delete("/{item_problem_id}", status_code=status.HTTP_204_NO_CONTENT)
def resolve_problem(item_problem_id: int, db: DbSession):
    # A solved problem is no longer needed, so it is removed
    problem = db.get(ItemProblem, item_problem_id)
    if problem is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Probleem niet gevonden")
    db.delete(problem)
    db.commit()
