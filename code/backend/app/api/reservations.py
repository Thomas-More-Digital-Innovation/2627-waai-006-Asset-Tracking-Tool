from datetime import date, datetime, time

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..availability import reserved_per_item
from ..dependencies import CurrentUser, DbSession
from ..models import Department, Item, Reservation, ReservationItem
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
    count: int


class ReservationOverview(BaseModel):
    reservation_id: int
    start_date: date
    start_time: time
    end_date: date
    end_time: time
    department_name: str | None
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


@router.get("", response_model=list[ReservationOverview])
def list_my_reservations(current_user: CurrentUser, db: DbSession):
    """Returns the reservations of the current user that are still running or have yet to start."""
    reservations = db.scalars(
        select(Reservation)
        .where(
            Reservation.user_id == current_user.user_id,
            Reservation.end_date + Reservation.end_time > datetime.now(),
        )
        .options(
            selectinload(Reservation.department),
            selectinload(Reservation.reservation_items).selectinload(ReservationItem.item),
        )
        .order_by(Reservation.start_date, Reservation.start_time)
    ).all()
    return [
        ReservationOverview(
            reservation_id=reservation.reservation_id,
            start_date=reservation.start_date,
            start_time=reservation.start_time,
            end_date=reservation.end_date,
            end_time=reservation.end_time,
            department_name=reservation.department.name if reservation.department else None,
            items=[
                ReservedItem(item_id=line.item_id, name=line.item.name, count=line.count)
                for line in reservation.reservation_items
            ],
        )
        for reservation in reservations
    ]


@router.post("", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED)
def create_reservation(data: ReservationInput, current_user: CurrentUser, db: DbSession):
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
    reserved = reserved_per_item(db, start, end)
    shortages = [
        f"{item.name} (nog {max(item.count - reserved.get(item.item_id, 0), 0)} beschikbaar)"
        for item in items
        if wanted[item.item_id] > item.count - reserved.get(item.item_id, 0)
    ]
    if shortages:
        raise HTTPException(status.HTTP_409_CONFLICT, "Niet meer genoeg beschikbaar van: " + ", ".join(shortages))

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
