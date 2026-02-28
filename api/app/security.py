import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import bcrypt
from jose import jwt, JWTError

JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-prod")
JWT_ALG = "HS256"
JWT_EXP_MINUTES = int(os.getenv("JWT_EXP_MINUTES", "60"))

def hash_password(password: str) -> str:
    pw = password.encode("utf-8")
    # bcrypt only considers first 72 bytes; reject longer to avoid surprises
    if len(pw) > 72:
        raise ValueError("Password too long (bcrypt limit is 72 bytes).")
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pw, salt).decode("utf-8")

def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False

def create_access_token(subject: str, extra: Optional[dict[str, Any]] = None) -> str:
    payload: dict[str, Any] = {"sub": subject}
    if extra:
        payload.update(extra)
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXP_MINUTES)
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
