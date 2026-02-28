import os
from sqlmodel import Session, select

from .models import Org, User
from .security import hash_password

def bootstrap_if_configured(session: Session) -> None:
    org_name = os.getenv("ATLAS_BOOTSTRAP_ORG_NAME")
    admin_email = os.getenv("ATLAS_BOOTSTRAP_ADMIN_EMAIL")
    admin_password = os.getenv("ATLAS_BOOTSTRAP_ADMIN_PASSWORD")

    if not (org_name and admin_email and admin_password):
        return

    org = session.exec(select(Org)).first()
    if not org:
        org = Org(name=org_name)
        session.add(org)
        session.commit()

    # Idempotent: ensure the bootstrap admin always exists and matches current env.
    admin_email_norm = admin_email.strip().lower()
    user = session.exec(select(User).where(User.email == admin_email_norm)).first()
    if not user:
        user = User(
            email=admin_email_norm,
            password_hash=hash_password(admin_password),
            role="admin",
            is_active=True,
        )
        session.add(user)
        session.commit()
        return

    # Keep admin credentials in sync (useful after rebuilding images / changing bcrypt versions).
    user.password_hash = hash_password(admin_password)
    user.role = "admin"
    user.is_active = True
    session.add(user)
    session.commit()
