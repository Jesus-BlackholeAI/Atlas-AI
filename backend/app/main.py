fastapifuture__ import annotationsailStrTPException, Header
from sqlmodel import SQLModel, FieldCORSMiddleware
from sqlmodel import SQLModel, Session, select
from datetime import datetime
import os

from .db import engine, SessionLocal
from .models import Org, User
from .schemas import RegisterIn, LoginIn, TokenOut, MeOut
from .security import verify_password, create_access_token, hash_password, decode_token
from .bootstrap import bootstrap_if_configured

PRIVACY_VERSION = os.getenv("PRIVACY_VERSION", "1.0")

# Deshabilita /openapi.json y docs (evita que genere/exponga openapi.json)
app = FastAPI(
    title="Atlas AI API",
    openapi_url=None,
    docs_url=None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_session() -> Session:
    return SessionLocal()

@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)
    session = SessionLocal()
    try:
        bootstrap_if_configured(session)
    finally:
        session.close()

def get_current_user(authorization: str | None = Header(default=None), session: Session = Depends(get_session)) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_token(token)
        sub = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = session.exec(select(User).where(User.email == sub)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/legal/privacy-version")
def privacy_version():
    return {"privacy_version": PRIVACY_VERSION}

@app.get("/legal/privacy")
def privacy_text():
    return {
        "privacy_version": PRIVACY_VERSION,
        "title": "Política de Privacidad – Atlas AI",
        "controller": "BlackholeAI",
        "contact": "legal@blackholeai.es",
        "summary": [
            "Finalidad: gestión de cuenta, acceso, seguridad y mejora del servicio.",
            "Base legal: consentimiento.",
            "Derechos: acceso, rectificación, supresión, limitación, portabilidad y oposición.",
        ],
    }

@app.post("/register", response_model=TokenOut)
def register(data: RegisterIn, session: Session = Depends(get_session)):
    if not data.accept_privacy:
        raise HTTPException(status_code=400, detail="Debe aceptar la Política de Privacidad")

    existing = session.exec(select(User).where(User.email == data.email)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email ya registrado")

    org = session.exec(select(Org)).first()
    if not org:
        org_name = os.getenv("ATLAS_BOOTSTRAP_ORG_NAME", "BlackholeAI Consulting")
        org = Org(name=org_name)
        session.add(org)
        session.commit()
        session.refresh(org)

    user = User(
        org_id=org.id,
        email=data.email,
        password_hash=hash_password(data.password),
        role="user",
        is_active=True,
        accepted_privacy_at=datetime.utcnow(),
        privacy_version=PRIVACY_VERSION,
    )
    session.add(user)
    session.commit()

    return TokenOut(access_token=create_access_token(sub=user.email))

@app.post("/login", response_model=TokenOut)
def login(data: LoginIn, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == data.email)).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuario inactivo")
    return TokenOut(access_token=create_access_token(sub=user.email))

@app.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user)):
    return MeOut(
        id=user.id,
        email=user.email,
        role=user.role,
        org_id=user.org_id,
        accepted_privacy_at=user.accepted_privacy_at.isoformat() if user.accepted_privacy_at else None,
        privacy_version=user.privacy_version,
    )
