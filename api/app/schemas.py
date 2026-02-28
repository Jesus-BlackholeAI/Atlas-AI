from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    accept_privacy: bool = True
    accept_terms: bool = True


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeOut(BaseModel):
    id: int
    email: EmailStr
    role: str
    is_active: bool


class EventIn(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    label: Optional[int] = Field(default=None, description="Optional 0/1 label to train online model")


class EventOut(BaseModel):
    id: int
    text: str
    label: Optional[int]
    created_at: datetime


class PredictOut(BaseModel):
    proba: float


class DBQueryIn(BaseModel):
    connection_url: str
    query: str
    text_column: str = "text"
    label_column: Optional[str] = None
