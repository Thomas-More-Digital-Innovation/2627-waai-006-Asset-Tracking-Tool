from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..availability import broken_per_item, reserved_per_item
from ..dependencies import CurrentUser, DbSession, get_admin_user
from ..models import Department, Item, ItemProblem, Reservation, ReservationItem, User
from .settings import get_application_setting

router = APIRouter(prefix="/reservations", tags=["reservations"])


class ReservationLine(BaseModel):
    item_id: int
    count: int = Field(ge=1)


class ReservationInput(BaseModel):
    start_date: date
    start_time: time
    end_date: date
    end_time: time
    department_id: int
    items: list[ReservationLine] = Field(min_length=1)


class ItemProblemInput(BaseModel):
    item_id: int
    note: str = Field(min_length=1)


class ReturnInput(BaseModel):
    # Problems found on items while checking them on return, one for every piece with a problem
    problems: list[ItemProblemInput] = []


class ReservationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    reservation_id: int
    start_date: date
    start_time: time
    end_date: date
    end_time: time
    department_id: int | None


class ReservedItem(BaseModel):
    item_id: int
    name: str
    article_number: str | None
    count: int


class ReservationOverview(BaseModel):
    reservation_id: int
    start_date: date
    start_time: time
    end_date: date
    end_time: time
    department_id: int | None
    department_name: str | None
    department_mail: str | None
    # Who placed the reservation, shown to admins who see the reservations of everyone
    user_name: str
    items: list[ReservedItem]


def check_summer_rules(db: Session, data: ReservationInput) -> None:
    """Refuses a reservation that does not follow the summer times and weekdays, when those are set."""
    setting = get_application_setting(db)
    if not setting.is_summer_time:
        return

    problems = []
    if setting.summer_start_time and data.start_time != setting.summer_start_time:
        problems.append(f"starten kan alleen om {setting.summer_start_time:%H:%M}")
    if setting.summer_end_time and data.end_time != setting.summer_end_time:
        problems.append(f"eindigen kan alleen om {setting.summer_end_time:%H:%M}")
    # The weekday ids run from 1 (Monday) to 7 (Sunday), the same numbering as isoweekday()
    if setting.summer_start_day and data.start_date.isoweekday() != setting.summer_start_day.day_of_week_id:
        problems.append(f"starten kan alleen op {setting.summer_start_day.name.lower()}")
    if setting.summer_end_day and data.end_date.isoweekday() != setting.summer_end_day.day_of_week_id:
        problems.append(f"eindigen kan alleen op {setting.summer_end_day.name.lower()}")
    if problems:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Zomerregeling: " + ", ".join(problems))


def list_current_reservations(db: Session, user_id: int | None = None) -> list[ReservationOverview]:
    """Returns the reservations that are still running or have yet to start, of one user or of everyone."""
    query = (
        select(Reservation)
        .where(Reservation.end_date + Reservation.end_time > datetime.now())
        .options(
            selectinload(Reservation.department),
            selectinload(Reservation.user),
            selectinload(Reservation.reservation_items).selectinload(ReservationItem.item),
        )
        .order_by(Reservation.start_date, Reservation.start_time)
    )
    if user_id is not None:
        query = query.where(Reservation.user_id == user_id)

    return [
        ReservationOverview(
            reservation_id=reservation.reservation_id,
            start_date=reservation.start_date,
            start_time=reservation.start_time,
            end_date=reservation.end_date,
            end_time=reservation.end_time,
            department_id=reservation.department_id,
            department_name=reservation.department.name if reservation.department else None,
            department_mail=reservation.department.mail if reservation.department else None,
            user_name=f"{reservation.user.firstname} {reservation.user.lastname}",
            items=[
                ReservedItem(
                    item_id=line.item_id,
                    name=line.item.name,
                    article_number=line.item.article_number,
                    count=line.count,
                )
                for line in reservation.reservation_items
            ],
        )
        for reservation in db.scalars(query).all()
    ]


@router.get("", response_model=list[ReservationOverview])
def list_my_reservations(current_user: CurrentUser, db: DbSession):
    return list_current_reservations(db, current_user.user_id)


@router.get("/all", response_model=list[ReservationOverview], dependencies=[Depends(get_admin_user)])
def list_all_reservations(db: DbSession):
    return list_current_reservations(db)


def get_accessible_reservation(db: Session, reservation_id: int, user: User) -> Reservation:
    """Returns a reservation of the user; an admin can reach the reservation of anyone."""
    reservation = db.get(Reservation, reservation_id)
    # Someone else's reservation is answered the same as a missing one, so it does not reveal that it exists
    if reservation is None or (reservation.user_id != user.user_id and not user.is_admin):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reservering niet gevonden")
    return reservation


def get_changeable_reservation(db: Session, reservation_id: int, user: User, action: str) -> Reservation:
    """Returns a reservation the user may cancel or change: one that has not started yet, or any for an admin."""
    reservation = get_accessible_reservation(db, reservation_id, user)
    if not user.is_admin and datetime.combine(reservation.start_date, reservation.start_time) <= datetime.now():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Een lopende reservering kan niet {action} worden")
    return reservation


@router.delete("/{reservation_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_reservation(reservation_id: int, current_user: CurrentUser, db: DbSession):
    """Cancels a reservation that has not started yet. An admin can cancel any reservation, also a running one."""
    reservation = get_changeable_reservation(db, reservation_id, current_user, "geannuleerd")

    for line in reservation.reservation_items:
        db.delete(line)
    db.delete(reservation)
    db.commit()


@router.post(
    "/{reservation_id}/return",
    response_model=ReservationResponse,
    dependencies=[Depends(get_admin_user)],
)
def return_reservation(
    reservation_id: int, current_user: CurrentUser, db: DbSession, data: ReturnInput | None = None
):
    """Marks the items of a running reservation as given back, by letting the reservation end now.

    The reservation is kept as history, but its items are free again right away.
    Problems found on the items are saved together with the return.
    """
    reservation = get_accessible_reservation(db, reservation_id, current_user)
    now = datetime.now().replace(second=0, microsecond=0)
    if datetime.combine(reservation.start_date, reservation.start_time) > now:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Deze reservering is nog niet begonnen")
    if datetime.combine(reservation.end_date, reservation.end_time) <= now:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Deze reservering is al afgelopen")

    problems = data.problems if data else []
    reserved = {line.item_id: line for line in reservation.reservation_items}
    # Every problem is one piece, so an item cannot have more problems than pieces were reserved
    reported: dict[int, int] = {}
    for problem in problems:
        if problem.item_id not in reserved:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Een probleem kan alleen gemeld worden op een item van deze reservering"
            )
        reported[problem.item_id] = reported.get(problem.item_id, 0) + 1
    for item_id, count in reported.items():
        line = reserved[item_id]
        if count > line.count:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"Er waren maar {line.count} van {line.item.name} gereserveerd"
            )

    reservation.end_date = now.date()
    reservation.end_time = now.time()
    db.add_all(ItemProblem(item_id=problem.item_id, note=problem.note.strip()) for problem in problems)
    db.commit()
    return reservation


def check_reservation(
    db: Session, data: ReservationInput, exclude_reservation_id: int | None = None
) -> tuple[Department, dict[int, int]]:
    """Checks the period, department and items of a reservation and returns the department and the count per item.

    When an existing reservation is changed, its own items are not counted as taken.
    """
    start = datetime.combine(data.start_date, data.start_time)
    end = datetime.combine(data.end_date, data.end_time)
    if end <= start:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Het einde moet na het begin liggen")
    check_summer_rules(db, data)

    department = db.get(Department, data.department_id)
    if department is None or not department.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Onbekende afdeling")

    # The same item on several lines is added up to one total
    wanted: dict[int, int] = {}
    for line in data.items:
        wanted[line.item_id] = wanted.get(line.item_id, 0) + line.count

    # Locks the items until this reservation is saved, so two people booking the last one
    # at the same moment are handled one after the other
    items = db.scalars(
        select(Item).where(Item.item_id.in_(wanted), Item.is_active).order_by(Item.item_id).with_for_update()
    ).all()
    if len(items) != len(wanted):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Een van de items bestaat niet meer")

    # Checked again here, because someone else may have reserved since the page was loaded
    reserved = reserved_per_item(db, start, end, exclude_reservation_id)
    # Pieces with an open problem cannot be booked
    broken = broken_per_item(db)
    available = {
        item.item_id: item.count - broken.get(item.item_id, 0) - reserved.get(item.item_id, 0) for item in items
    }
    shortages = [
        f"{item.name} (nog {max(available[item.item_id], 0)} beschikbaar)"
        for item in items
        if wanted[item.item_id] > available[item.item_id]
    ]
    if shortages:
        raise HTTPException(status.HTTP_409_CONFLICT, "Niet meer genoeg beschikbaar van: " + ", ".join(shortages))

    return department, wanted


@router.post("", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED)
def create_reservation(data: ReservationInput, current_user: CurrentUser, db: DbSession):
    department, wanted = check_reservation(db, data)

    reservation = Reservation(
        user_id=current_user.user_id,
        department_id=department.department_id,
        date_time=datetime.now(),
        start_date=data.start_date,
        start_time=data.start_time,
        end_date=data.end_date,
        end_time=data.end_time,
        reservation_items=[ReservationItem(item_id=item_id, count=count) for item_id, count in wanted.items()],
    )
    db.add(reservation)
    db.commit()
    return reservation


@router.put("/{reservation_id}", response_model=ReservationResponse)
def update_reservation(reservation_id: int, data: ReservationInput, current_user: CurrentUser, db: DbSession):
    """Changes the period, department and items of a reservation that has not started yet, or any for an admin."""
    reservation = get_changeable_reservation(db, reservation_id, current_user, "gewijzigd")
    department, wanted = check_reservation(db, data, reservation.reservation_id)

    # The old lines are replaced by the new ones; the owner and the moment of placing stay the same
    for line in reservation.reservation_items:
        db.delete(line)
    db.flush()
    reservation.department_id = department.department_id
    reservation.start_date = data.start_date
    reservation.start_time = data.start_time
    reservation.end_date = data.end_date
    reservation.end_time = data.end_time
    reservation.reservation_items = [ReservationItem(item_id=item_id, count=count) for item_id, count in wanted.items()]
    db.commit()
    return reservation
