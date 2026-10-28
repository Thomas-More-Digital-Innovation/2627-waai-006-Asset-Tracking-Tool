import csv
import io
from datetime import date, datetime, time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..availability import broken_per_item, reserved_per_item
from ..dependencies import CurrentUser, DbSession, get_admin_user
from ..images import delete_image, image_path, save_image
from ..models import Category, Item
from .reservations import get_accessible_reservation

router = APIRouter(prefix="/items", tags=["items"])


class ItemInput(BaseModel):
    # Optional, but when filled in it must be unique
    article_number: Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)] | None = None
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
    detail: str | None = None
    count: int = Field(ge=0)
    category_id: int


class ItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    item_id: int
    article_number: str | None
    name: str
    photo: str | None
    detail: str | None
    count: int
    category_id: int
    is_active: bool


class ItemAvailability(ItemResponse):
    # How many of this item are still free in the requested period
    available: int


def get_item(db: Session, item_id: int) -> Item:
    item = db.get(Item, item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item niet gevonden")
    return item


def find_item_by_article_number(db: Session, article_number: str) -> Item | None:
    return db.scalars(select(Item).where(Item.article_number == article_number)).first()


def apply_input(db: Session, item: Item, data: ItemInput) -> None:
    if db.get(Category, data.category_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Onbekende categorie")
    article_number = data.article_number or None
    if article_number is not None:
        existing = find_item_by_article_number(db, article_number)
        if existing is not None and existing is not item:
            raise HTTPException(status.HTTP_409_CONFLICT, "Er bestaat al een item met dit artikelnummer")
    item.article_number = article_number
    item.name = data.name
    item.detail = data.detail.strip() or None if data.detail else None
    item.count = data.count
    item.category_id = data.category_id


@router.get("", response_model=list[ItemResponse], dependencies=[Depends(get_admin_user)])
def list_items(db: DbSession):
    # Active items first, inactive items at the bottom
    return db.scalars(select(Item).order_by(Item.is_active.desc(), Item.name)).all()


@router.get("/export", dependencies=[Depends(get_admin_user)])
def export_items(db: DbSession):
    broken = broken_per_item(db)
    items = db.scalars(select(Item).order_by(Item.name)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Naam", "Artikelnummer", "Aantal", "Categorie", "Aantal kapot"])
    for item in items:
        writer.writerow([item.name, item.article_number, item.count, item.category.name, broken.get(item.item_id, 0)])

    return Response(
        output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="materiaal.csv"'},
    )


@router.get("/available", response_model=list[ItemAvailability])
def list_available_items(
    current_user: CurrentUser,
    db: DbSession,
    start_date: date,
    start_time: time,
    end_date: date,
    end_time: time,
    # While changing a reservation its own items count as free
    reservation_id: int | None = None,
):
    start = datetime.combine(start_date, start_time)
    end = datetime.combine(end_date, end_time)
    if end <= start:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Het einde moet na het begin liggen")
    if reservation_id is not None:
        get_accessible_reservation(db, reservation_id, current_user)

    reserved = reserved_per_item(db, start, end, reservation_id)
    # Pieces with an open problem cannot be booked until the problem is solved
    broken = broken_per_item(db)
    items = db.scalars(select(Item).where(Item.is_active).order_by(Item.name)).all()
    result = []
    for item in items:
        available = item.count - broken.get(item.item_id, 0) - reserved.get(item.item_id, 0)
        if available > 0:
            result.append(ItemAvailability(**ItemResponse.model_validate(item).model_dump(), available=available))
    return result


@router.post(
    "",
    response_model=ItemResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_admin_user)],
)
def create_item(data: ItemInput, db: DbSession):
    item = Item()
    apply_input(db, item, data)
    db.add(item)
    db.commit()
    return item


@router.put("/{item_id}", response_model=ItemResponse, dependencies=[Depends(get_admin_user)])
def update_item(item_id: int, data: ItemInput, db: DbSession):
    item = get_item(db, item_id)
    apply_input(db, item, data)
    db.commit()
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(get_admin_user)])
def deactivate_item(item_id: int, db: DbSession):
    # Items are never removed, so existing reservations keep their item
    get_item(db, item_id).is_active = False
    db.commit()


@router.post("/{item_id}/activate", response_model=ItemResponse, dependencies=[Depends(get_admin_user)])
def activate_item(item_id: int, db: DbSession):
    item = get_item(db, item_id)
    item.is_active = True
    db.commit()
    return item


@router.put("/{item_id}/photo", response_model=ItemResponse, dependencies=[Depends(get_admin_user)])
def upload_photo(item_id: int, file: UploadFile, db: DbSession):
    item = get_item(db, item_id)
    old_photo = item.photo
    item.photo = save_image(file)
    db.commit()
    # The old file is removed only after the new one is stored and saved
    delete_image(old_photo)
    return item


@router.delete("/{item_id}/photo", response_model=ItemResponse, dependencies=[Depends(get_admin_user)])
def remove_photo(item_id: int, db: DbSession):
    item = get_item(db, item_id)
    old_photo = item.photo
    item.photo = None
    db.commit()
    delete_image(old_photo)
    return item


@router.get("/photos/{filename}")
def read_photo(filename: str, current_user: CurrentUser):
    path = image_path(filename)
    if path is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Afbeelding niet gevonden")
    # A filename never gets different content, so the browser may keep the image
    return FileResponse(path, headers={"Cache-Control": "private, max-age=31536000, immutable"})
