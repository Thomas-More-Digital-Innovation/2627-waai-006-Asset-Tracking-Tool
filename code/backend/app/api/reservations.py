from datetime import date, datetime, time

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from ..availability import reserved_per_item
from ..dependencies import CurrentUser, DbSession
from ..models import Department, Item, Reservation, ReservationItem

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


@router.post("", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED)
def create_reservation(data: ReservationInput, current_user: CurrentUser, db: DbSession):
    start = datetime.combine(data.start_date, data.start_time)
    end = datetime.combine(data.end_date, data.end_time)
    if end <= start:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Het einde moet na het begin liggen")

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
