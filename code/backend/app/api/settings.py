from datetime import time
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..dependencies import CurrentUser, DbSession, get_admin_user
from ..models import ApplicationSetting, DayOfWeek

router = APIRouter(tags=["settings"])


class DayOfWeekResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    day_of_week_id: int
    name: str


class ApplicationSettingSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    is_summer_time: bool
    summer_start_time: time | None = None
    summer_end_time: time | None = None
    summer_start_date_of_week: int | None = None
    # The start and end time are not compared: a reservation can run over several days,
    # for example from Friday 16:00 to Monday 09:00, so an end time before the start time is valid.
    # Each reservation itself is still checked to end after it starts.
    summer_end_date_of_week: int | None = None


def get_application_setting(db: Session) -> ApplicationSetting:
    # The application has a single settings row, created on first use
    setting = db.scalars(select(ApplicationSetting)).first()
    if setting is None:
        setting = ApplicationSetting(is_summer_time=False)
        db.add(setting)
        db.commit()
    return setting


@router.get("/days-of-week", response_model=list[DayOfWeekResponse])
def list_days_of_week(current_user: CurrentUser, db: DbSession):
    return db.scalars(select(DayOfWeek).order_by(DayOfWeek.day_of_week_id)).all()


@router.get("/settings", response_model=ApplicationSettingSchema)
def read_settings(current_user: CurrentUser, db: DbSession):
    # Every logged-in user may read the settings, the reservation form needs them
    return get_application_setting(db)


@router.put("/settings", response_model=ApplicationSettingSchema, dependencies=[Depends(get_admin_user)])
def update_settings(new_settings: ApplicationSettingSchema, db: DbSession):
    for day_id in (new_settings.summer_start_date_of_week, new_settings.summer_end_date_of_week):
        if day_id is not None and db.get(DayOfWeek, day_id) is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Onbekende weekdag")

    setting = get_application_setting(db)
    for field, value in new_settings.model_dump().items():
        setattr(setting, field, value)
    db.commit()
    return setting
