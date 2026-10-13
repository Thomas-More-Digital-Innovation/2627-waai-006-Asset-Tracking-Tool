from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..dependencies import CurrentUser, DbSession, get_admin_user
from ..images import delete_image, image_path, save_image
from ..models import Category, Item

router = APIRouter(prefix="/items", tags=["items"])


class ItemInput(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
    detail: str | None = None
    count: int = Field(ge=0)
    category_id: int


class ItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    item_id: int
    name: str
    photo: str | None
    detail: str | None
    count: int
    category_id: int
    is_active: bool


def get_item(db: Session, item_id: int) -> Item:
    item = db.get(Item, item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item niet gevonden")
    return item


def apply_input(db: Session, item: Item, data: ItemInput) -> None:
    if db.get(Category, data.category_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Onbekende categorie")
    item.name = data.name
    item.detail = data.detail.strip() or None if data.detail else None
    item.count = data.count
    item.category_id = data.category_id


@router.get("", response_model=list[ItemResponse])
def list_items(current_user: CurrentUser, db: DbSession, include_inactive: bool = False):
    query = select(Item).order_by(Item.is_active.desc(), Item.name)
    if not include_inactive:
        query = query.where(Item.is_active)
    elif not current_user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Alleen voor beheerders")
    return db.scalars(query).all()


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
