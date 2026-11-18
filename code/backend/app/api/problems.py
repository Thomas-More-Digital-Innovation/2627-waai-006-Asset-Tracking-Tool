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


class WriteOffShortage(BaseModel):
    reservation_id: int
    start_date: date
    start_time: time
    end_date: date
    end_time: time
    department_name: str | None
    user_name: str
    count: int
    # How many pieces are left for this reservation once the broken one is gone
    available: int


def find_problem(db: Session, item_problem_id: int) -> ItemProblem:
    problem = db.get(ItemProblem, item_problem_id)
    if problem is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Probleem niet gevonden")
    return problem


def write_off_shortages(db: Session, item: Item) -> list[WriteOffShortage]:
    """Returns the reservations that have not ended yet and would have too few pieces once one piece is gone."""
    end = Reservation.end_date + Reservation.end_time
    lines = db.scalars(
        select(ReservationItem)
        .join(ReservationItem.reservation)
        .where(ReservationItem.item_id == item.item_id, end > datetime.now(), Reservation.returned_at.is_(None))
        .options(
            selectinload(ReservationItem.reservation).selectinload(Reservation.department),
            selectinload(ReservationItem.reservation).selectinload(Reservation.user),
        )
    ).all()

    # The same item can be on several lines of one reservation, those are added up
    needed: dict[int, int] = {}
    reservations: dict[int, Reservation] = {}
    for line in lines:
        needed[line.reservation_id] = needed.get(line.reservation_id, 0) + line.count
        reservations[line.reservation_id] = line.reservation

    # After the write-off there is one piece less and one open problem less
    stock = item.count - 1
    broken = broken_per_item(db).get(item.item_id, 0) - 1
    result: list[WriteOffShortage] = []
    for reservation_id, count in needed.items():
        reservation = reservations[reservation_id]
        reserved = reserved_per_item(
            db,
            datetime.combine(reservation.start_date, reservation.start_time),
            datetime.combine(reservation.end_date, reservation.end_time),
            reservation_id,
        ).get(item.item_id, 0)
        available = max(stock - broken - reserved, 0)
        if count > available:
            result.append(
                WriteOffShortage(
                    reservation_id=reservation_id,
                    start_date=reservation.start_date,
                    start_time=reservation.start_time,
                    end_date=reservation.end_date,
                    end_time=reservation.end_time,
                    department_name=reservation.department.name if reservation.department else None,
                    user_name=f"{reservation.user.firstname} {reservation.user.lastname}",
                    count=count,
                    available=available,
                )
            )
    result.sort(key=lambda shortage: (shortage.start_date, shortage.start_time))
    return result


@router.get("/{item_problem_id}/write-off", response_model=list[WriteOffShortage])
def check_write_off(item_problem_id: int, db: DbSession):
    """Lists the reservations that stand in the way of removing this piece from the stock."""
    return write_off_shortages(db, find_problem(db, item_problem_id).item)


@router.post("/{item_problem_id}/write-off", status_code=status.HTTP_204_NO_CONTENT)
def write_off_problem(item_problem_id: int, db: DbSession):
    # The piece is broken beyond repair, so it leaves the stock together with its problem
    problem = find_problem(db, item_problem_id)
    item = problem.item
    # Checked again here, because reservations may have changed since the check was shown
    if write_off_shortages(db, item):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Er zijn reserveringen die dan te weinig hebben, pas die eerst aan",
        )
    item.count = max(item.count - 1, 0)
    # Without pieces left the item is removed, the same way as on the manage page so old reservations keep it
    if item.count == 0:
        item.is_active = False
    db.delete(problem)
    db.commit()
