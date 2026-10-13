import os
import re
import uuid
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "uploads"))
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_IMAGE_SIZE = (1000, 1000)
FILENAME_PATTERN = re.compile(r"^[0-9a-f]{32}\.webp$")


def save_image(file: UploadFile) -> str:
    """Shrinks an uploaded image, stores it as WebP and returns the new filename."""
    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "De afbeelding is te groot (maximaal 10 MB)")

    try:
        image = Image.open(BytesIO(content))
        if image.format not in ("JPEG", "PNG", "WEBP"):
            raise ValueError("unsupported format")
        # Phone photos store their rotation separately, this turns the pixels the right way up
        image = ImageOps.exif_transpose(image)
        # Makes the image fit within the maximum size, it is never enlarged
        image.thumbnail(MAX_IMAGE_SIZE)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Upload een JPG-, PNG- of WebP-afbeelding")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.webp"
    image.save(UPLOAD_DIR / filename, "WEBP", quality=80)
    return filename


def image_path(filename: str) -> Path | None:
    # Only names this module created are accepted, so a request can never reach other files
    path = UPLOAD_DIR / filename
    if not FILENAME_PATTERN.match(filename) or not path.is_file():
        return None
    return path


def delete_image(filename: str | None) -> None:
    path = image_path(filename) if filename else None
    if path is not None:
        path.unlink()
