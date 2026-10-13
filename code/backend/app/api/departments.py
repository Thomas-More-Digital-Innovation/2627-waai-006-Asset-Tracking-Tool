from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, StringConstraints
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..dependencies import CurrentUser, DbSession, get_admin_user
from ..models import Department

router = APIRouter(prefix="/departments", tags=["departments"])


class DepartmentInput(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
    mail: Annotated[
        str,
        StringConstraints(strip_whitespace=True, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"),
    ]


class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    department_id: int
    name: str
    mail: str


def get_department(db: Session, department_id: int) -> Department:
    department = db.get(Department, department_id)
    if department is None or not department.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Afdeling niet gevonden")
    return department


@router.get("", response_model=list[DepartmentResponse])
def list_departments(current_user: CurrentUser, db: DbSession):
    return db.scalars(select(Department).where(Department.is_active).order_by(Department.name)).all()


@router.post(
    "",
    response_model=DepartmentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_admin_user)],
)
def create_department(data: DepartmentInput, db: DbSession):
    department = Department(name=data.name, mail=data.mail)
    db.add(department)
    db.commit()
    return department


@router.put("/{department_id}", response_model=DepartmentResponse, dependencies=[Depends(get_admin_user)])
def update_department(department_id: int, data: DepartmentInput, db: DbSession):
    department = get_department(db, department_id)
    department.name = data.name
    department.mail = data.mail
    db.commit()
    return department


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(get_admin_user)])
def delete_department(department_id: int, db: DbSession):
    # Departments are never removed, so existing reservations keep their department
    get_department(db, department_id).is_active = False
    db.commit()
