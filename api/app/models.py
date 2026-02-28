from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import SQLModel, Field


class Org(SQLModel, table=True):
    __tablename__ = "org"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str


class User(SQLModel, table=True):
    __tablename__ = "user"
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True)
    password_hash: str
    role: str = Field(default="user")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Event(SQLModel, table=True):
    __tablename__ = "event"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    text: str
    label: Optional[int] = Field(default=None)  # optional supervision for online learning (0/1)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
