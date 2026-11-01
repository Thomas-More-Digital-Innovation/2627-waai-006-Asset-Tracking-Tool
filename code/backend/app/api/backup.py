# Imports
import json
import os
import tempfile
import zipfile
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, TypeAdapter, ValidationError
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from starlette.background import BackgroundTask

from ..dependencies import DbSession, get_admin_user
from ..images import FILENAME_PATTERN, MAX_UPLOAD_BYTES, delete_image, image_path, store_image
from ..models import Category, Department, Item

router = APIRouter(prefix="/backup", tags=["backup"], dependencies=[Depends(get_admin_user)])

MAX_DATA_BYTES = 50 * 1024 * 1024

# Text that may not be empty and fits in a String(255) column, so a bad backup is refused before it reaches the database
Text255 = Annotated[str, StringConstraints(min_length=1, max_length=255)]


class CategoryBackup(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    category_id: int
    name: Text255


class DepartmentBackup(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    department_id: int
    name: Text255
    mail: Text255
    is_active: bool = True


class ItemBackup(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    item_id: int
    article_number: Annotated[str, StringConstraints(max_length=255)] | None = None
    name: Text255
    photo: str | None = None
    detail: str | None = None
    count: int = Field(ge=0)
    category_id: int
    is_active: bool = True


class BackupSummary(BaseModel):
    categories: int
    departments: int
    items: int


# Every table in the backup, with the file it is stored in and its primary key column
TABLES = [
    ("categories", Category, CategoryBackup, "category_id"),
    ("departments", Department, DepartmentBackup, "department_id"),
    ("items", Item, ItemBackup, "item_id"),
]


@router.get("")
def download_backup(db: DbSession):
    # The zip is built in a temporary file, so a large backup does not have to fit in memory
    archive_file = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    with archive_file, zipfile.ZipFile(archive_file, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, model, schema, key in TABLES:
            rows = db.scalars(select(model).order_by(getattr(model, key))).all()
            data = [schema.model_validate(row).model_dump(mode="json") for row in rows]
            archive.writestr(f"data/{name}.json", json.dumps(data, ensure_ascii=False, indent=2))

        for photo in db.scalars(select(Item.photo).where(Item.photo.is_not(None)).distinct()):
            path = image_path(photo)
            if path is not None:
                # WebP is already compressed, packing it again only costs time
                archive.write(path, f"images/{photo}", compress_type=zipfile.ZIP_STORED)

    return FileResponse(
        archive_file.name,
        media_type="application/zip",
        filename=f"backup-{date.today()}.zip",
        background=BackgroundTask(os.unlink, archive_file.name),
    )


def read_table[T](archive: zipfile.ZipFile, name: str, schema: type[T]) -> list[T]:
    """Reads data/<name>.json from the backup and checks every row against the schema.

    T is the schema class, so reading categories with CategoryBackup returns a list of CategoryBackup.
    A missing, too large or invalid file is refused with a readable error.
    """
    path = f"data/{name}.json"
    try:
        info = archive.getinfo(path)
    except KeyError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"De backup mist het bestand {path}")
    if info.file_size > MAX_DATA_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Het bestand {path} is te groot")
    try:
        return TypeAdapter(list[schema]).validate_json(archive.read(info))
    except (ValidationError, zipfile.BadZipFile):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Het bestand {path} is ongeldig")


def restore_photos(archive: zipfile.ZipFile, items: list[ItemBackup]) -> list[str]:
    """Stores the photos from the backup that are not on disk yet and returns their filenames.

    An item whose photo is missing or broken is restored without a photo.
    """
    written = []
    for item in items:
        # A filename never gets different content, so a photo that is already there stays as it is
        if item.photo is None or image_path(item.photo) is not None:
            continue
        # Only names in the form the application makes itself, so a backup can never write outside the folder
        if not FILENAME_PATTERN.match(item.photo):
            item.photo = None
            continue
        try:
            info = archive.getinfo(f"images/{item.photo}")
            if info.file_size > MAX_UPLOAD_BYTES:
                raise ValueError("image too large")
            store_image(archive.read(info), item.photo)
            written.append(item.photo)
        except (KeyError, ValueError, HTTPException, zipfile.BadZipFile):
            item.photo = None
    return written


def reset_sequences(db: DbSession) -> None:
    # Rows are restored with their own id, so new rows must continue after the highest id
    for name, _, _, key in TABLES:
        db.execute(
            text(f"SELECT setval(pg_get_serial_sequence('{name}', '{key}'), COALESCE(MAX({key}), 0) + 1, false) FROM {name}")
        )


@router.post("", response_model=BackupSummary)
def upload_backup(file: UploadFile, db: DbSession):
    try:
        archive = zipfile.ZipFile(file.file)
    except zipfile.BadZipFile:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Upload een backup als zip-bestand")

    with archive:
        categories = read_table(archive, "categories", CategoryBackup)
        departments = read_table(archive, "departments", DepartmentBackup)
        items = read_table(archive, "items", ItemBackup)

        known_categories = {category.category_id for category in categories}
        known_categories.update(db.scalars(select(Category.category_id)))
        for item in items:
            if item.category_id not in known_categories:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Item {item.name} heeft een onbekende categorie")
            item.article_number = item.article_number or None

        written = restore_photos(archive, items)

    old_photos = set(db.scalars(select(Item.photo).where(Item.photo.is_not(None))))
    try:
        # Rows with an id that already exists are overwritten, the others are added,
        # so reservations and problems keep pointing to the right item and department
        for category in categories:
            db.merge(Category(**category.model_dump()))
        for department in departments:
            db.merge(Department(**department.model_dump()))
        for item in items:
            db.merge(Item(**item.model_dump()))
        db.flush()
        reset_sequences(db)
        db.commit()
    except IntegrityError:
        db.rollback()
        for filename in written:
            delete_image(filename)
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "De backup botst met de bestaande gegevens, bijvoorbeeld een artikelnummer dat al bij een ander item hoort",
        )

    # Photos that were replaced by the backup are no longer used by any item
    in_use = set(db.scalars(select(Item.photo).where(Item.photo.is_not(None))))
    for photo in old_photos - in_use:
        delete_image(photo)

    return BackupSummary(categories=len(categories), departments=len(departments), items=len(items))
