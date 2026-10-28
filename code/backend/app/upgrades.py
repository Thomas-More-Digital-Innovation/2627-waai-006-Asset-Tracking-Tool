from datetime import datetime

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def add_returned_at(engine: Engine) -> None:
    """Adds the returned_at column to a database made before it existed.

    create_all only makes missing tables, it never adds a column to an existing one.
    Reservations that had already ended count as given back, so they do not all come back in the list.
    """
    columns = {column["name"] for column in inspect(engine).get_columns("reservations")}
    if "returned_at" in columns:
        return
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE reservations ADD COLUMN returned_at TIMESTAMP"))
        # The time comes from Python and not from now() in the database, which runs in another time zone
        connection.execute(
            text("UPDATE reservations SET returned_at = end_date + end_time WHERE end_date + end_time <= :now"),
            {"now": datetime.now()},
        )
