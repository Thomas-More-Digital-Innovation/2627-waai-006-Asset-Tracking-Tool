from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, StringConstraints
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..dependencies import CurrentUser, DbSession, get_admin_user
from ..models import Category

router = APIRouter(prefix="/categories", tags=["categories"])


class CategoryInput(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    category_id: int
    name: str


def get_category(db: Session, category_id: int) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categorie niet gevonden")
    return category


@router.get("", response_model=list[CategoryResponse])
def list_categories(current_user: CurrentUser, db: DbSession):
    return db.scalars(select(Category).order_by(Category.name)).all()


@router.post(
    "",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_admin_user)],
)
def create_category(data: CategoryInput, db: DbSession):
    category = Category(name=data.name)
    db.add(category)
    db.commit()
    return category


@router.put("/{category_id}", response_model=CategoryResponse, dependencies=[Depends(get_admin_user)])
def update_category(category_id: int, data: CategoryInput, db: DbSession):
    category = get_category(db, category_id)
    category.name = data.name
    db.commit()
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(get_admin_user)])
def delete_category(category_id: int, db: DbSession):
    category = get_category(db, category_id)
    if category.items:
        raise HTTPException(status.HTTP_409_CONFLICT, "Deze categorie wordt nog gebruikt door items")
    db.delete(category)
    db.commit()
