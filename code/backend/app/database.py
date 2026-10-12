import os

from sqlalchemy import URL, create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = URL.create(
    "postgresql+psycopg",
    username=os.environ["POSTGRES_USER"],
    password=os.environ["POSTGRES_PASSWORD"],
    host=os.environ["POSTGRES_HOST"],
    port=int(os.environ["POSTGRES_PORT"]),
    database=os.environ["POSTGRES_DB"],
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


def get_db():
    with SessionLocal() as session:
        yield session
