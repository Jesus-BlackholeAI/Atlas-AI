import os
import time
from typing import Generator

from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.exc import OperationalError

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"prepare_threshold": None},
)

def init_db() -> None:
    """Create tables. Retries a bit to allow Postgres container to become ready."""
    last_err: Exception | None = None
    for _ in range(30):
        try:
            SQLModel.metadata.create_all(engine)
            return
        except OperationalError as e:
            last_err = e
            time.sleep(1)
    if last_err:
        raise last_err

def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
