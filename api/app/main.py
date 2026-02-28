from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Annotated, Optional

from fastapi import Depends, FastAPI, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from sqlalchemy import func, case

from .db import init_db, get_session
from .models import Org, User, Event
from .schemas import RegisterIn, LoginIn, TokenOut, MeOut, EventIn, EventOut, PredictOut, DBQueryIn
from .security import verify_password, create_access_token, hash_password, decode_token
from .bootstrap import bootstrap_if_configured
from .ai_online import load_model, learn as learn_online, predict_proba

_model = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model
    init_db()
    _model = load_model()
    for session in get_session():
        bootstrap_if_configured(session)
        break
    yield

app = FastAPI(title="Atlas AI API", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)

cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _get_bearer_token(auth_header: Optional[str]) -> Optional[str]:
    if not auth_header:
        return None
    parts = auth_header.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return None

def get_current_user(
    session: Session = Depends(get_session),
    authorization: Annotated[Optional[str], Header()] = None,
) -> User:
    token = _get_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = session.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/auth/register", response_model=TokenOut)
def register(data: RegisterIn, session: Session = Depends(get_session)):
    if not data.accept_privacy or not data.accept_terms:
        raise HTTPException(status_code=400, detail="Privacy policy and terms must be accepted")
    email_norm = str(data.email).lower().strip()
    existing = session.exec(select(User).where(User.email == email_norm)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    try:
        pw_hash = hash_password(data.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    user = User(email=email_norm, password_hash=pw_hash, role="user", is_active=True)
    session.add(user)
    session.commit()
    session.refresh(user)
    token = create_access_token(str(user.id), {"role": user.role})
    return TokenOut(access_token=token)

@app.post("/auth/login", response_model=TokenOut)
def login(data: LoginIn, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == str(data.email).lower().strip())).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(str(user.id), {"role": user.role})
    return TokenOut(access_token=token)

@app.get("/me", response_model=MeOut)
def me(current: User = Depends(get_current_user)):
    return MeOut(id=current.id, email=current.email, role=current.role, is_active=current.is_active)

@app.post("/events", response_model=EventOut)
def create_event(payload: EventIn, session: Session = Depends(get_session), current: User = Depends(get_current_user)):
    ev = Event(user_id=current.id, text=payload.text, label=payload.label)
    session.add(ev)
    session.commit()
    session.refresh(ev)
    # optional online learning
    global _model
    if payload.label is not None:
        _model = learn_online(_model, payload.text, int(payload.label))
    return EventOut(id=ev.id, text=ev.text, label=ev.label, created_at=ev.created_at)

@app.get("/events", response_model=list[EventOut])
def list_events(session: Session = Depends(get_session), current: User = Depends(get_current_user)):
    rows = session.exec(select(Event).where(Event.user_id == current.id).order_by(Event.created_at.desc()).limit(50)).all()
    return [EventOut(id=r.id, text=r.text, label=r.label, created_at=r.created_at) for r in rows]

@app.get("/ai/predict", response_model=PredictOut)
def ai_predict(text: str, current: User = Depends(get_current_user)):
    global _model
    return PredictOut(proba=predict_proba(_model, text))

@app.post("/ai/learn", response_model=PredictOut)
def ai_learn(payload: EventIn, current: User = Depends(get_current_user)):
    if payload.label is None:
        raise HTTPException(status_code=400, detail="label is required to learn")
    global _model
    _model = learn_online(_model, payload.text, int(payload.label))
    return PredictOut(proba=predict_proba(_model, payload.text))


def _tokenize(text: str) -> list[str]:
    """Lightweight tokenizer for simple analytics."""
    import re

    text = text.lower()
    text = re.sub(r"[^a-záéíóúüñ0-9\s]", " ", text)
    tokens = [t for t in text.split() if len(t) > 2]
    stop = {
        "para", "con", "sin", "una", "uno", "que", "del", "los", "las", "por", "como",
        "este", "esta", "esto", "hay", "pero", "más", "muy", "todo", "toda", "todas",
        "sobre", "entre", "cuando", "donde", "porque", "ser", "son", "fue", "han",
    }
    return [t for t in tokens if t not in stop]


@app.get("/analytics/summary")
def analytics_summary(
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    from datetime import datetime, timedelta, timezone
    total = session.exec(select(func.count(Event.id)).where(Event.user_id == current.id)).one()
    labeled = session.exec(
        select(func.count(Event.id)).where(Event.user_id == current.id).where(Event.label.is_not(None))
    ).one()
    pos = session.exec(
        select(func.count(Event.id)).where(Event.user_id == current.id).where(Event.label == 1)
    ).one()
    neg = session.exec(
        select(func.count(Event.id)).where(Event.user_id == current.id).where(Event.label == 0)
    ).one()
    cutoff_7d = datetime.now(timezone.utc) - timedelta(days=7)
    last_7d = session.exec(
        select(func.count(Event.id))
        .where(Event.user_id == current.id)
        .where(Event.created_at >= cutoff_7d)
    ).one()
    last_7d_pos = session.exec(
        select(func.count(Event.id))
        .where(Event.user_id == current.id)
        .where(Event.created_at >= cutoff_7d)
        .where(Event.label == 1)
    ).one()
    last_7d_labeled = session.exec(
        select(func.count(Event.id))
        .where(Event.user_id == current.id)
        .where(Event.created_at >= cutoff_7d)
        .where(Event.label.is_not(None))
    ).one()
    return {
        "total_events": int(total),
        "labeled_events": int(labeled),
        "label1_events": int(pos),
        "label0_events": int(neg),
        "last_7d_events": int(last_7d),
        "last_7d_label1_rate": (float(last_7d_pos) / float(last_7d_labeled)) if last_7d_labeled else 0.0,
    }


@app.get("/analytics/timeseries")
def analytics_timeseries(
    days: int = Query(30, ge=1, le=365),
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # Group by date
    from datetime import datetime, timedelta, timezone

    date_expr = func.date(Event.created_at)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = session.exec(
        select(
            date_expr,
            func.count(Event.id),
            func.sum(case((Event.label.is_not(None), 1), else_=0)),
            func.sum(case((Event.label == 1, 1), else_=0)),
        )
        .where(Event.user_id == current.id)
        .where(Event.created_at >= cutoff)
        .group_by(date_expr)
        .order_by(date_expr.asc())
    ).all()
    out = []
    for d, cnt, labeled_cnt, pos_cnt in rows:
        out.append(
            {
                "date": str(d),
                "count": int(cnt or 0),
                "labeled": int(labeled_cnt or 0),
                "label1": int(pos_cnt or 0),
            }
        )
    return out


@app.get("/analytics/top_terms")
def analytics_top_terms(
    limit: int = Query(20, ge=5, le=100),
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    rows = session.exec(
        select(Event.text).where(Event.user_id == current.id).order_by(Event.created_at.desc()).limit(300)
    ).all()
    from collections import Counter

    c = Counter()
    for (text,) in rows:
        for t in _tokenize(text or ""):
            c[t] += 1
    return [{"term": k, "count": int(v)} for k, v in c.most_common(limit)]


@app.get("/ai/insights")
def ai_insights(
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Actionable recommendations based on recent ingests + online model."""
    # recent events
    rows = session.exec(
        select(Event.text, Event.label).where(Event.user_id == current.id).order_by(Event.created_at.desc()).limit(50)
    ).all()
    total = len(rows)
    labeled = sum(1 for _, l in rows if l is not None)
    pos = sum(1 for _, l in rows if l == 1)
    # simple heuristics
    insights = []
    if total == 0:
        insights.append(
            {
                "title": "Empieza a alimentar el modelo",
                "severity": "info",
                "recommendation": "Ingresa 10–20 eventos y etiqueta al menos 5 (0/1) para que la IA aprenda.",
                "rationale": "Sin datos no hay patrón. El aprendizaje online necesita ejemplos iniciales.",
            }
        )
        return insights

    if labeled < 5:
        insights.append(
            {
                "title": "Falta etiquetado para aprender",
                "severity": "warning",
                "recommendation": "Etiqueta al menos 5 eventos con 0/1. A partir de ahí la predicción mejora rápido.",
                "rationale": f"En los últimos {total} eventos solo {labeled} tienen etiqueta.",
            }
        )

    if labeled and (pos / max(1, labeled)) > 0.7:
        insights.append(
            {
                "title": "Alto volumen de incidencias críticas",
                "severity": "critical",
                "recommendation": "Crea un checklist de contención y prioriza los 3 términos más repetidos.",
                "rationale": "La mayoría de eventos etiquetados caen en la clase 1.",
            }
        )

    # top terms
    from collections import Counter

    c = Counter()
    for text, _ in rows:
        for t in _tokenize(text or ""):
            c[t] += 1
    top = [k for k, _ in c.most_common(3)]
    if top:
        insights.append(
            {
                "title": "Temas dominantes",
                "severity": "info",
                "recommendation": f"Revisa: {', '.join(top)}. Añade reglas/etiquetas para estos casos.",
                "rationale": "Aparecen de forma recurrente en los eventos recientes.",
            }
        )

    insights.append(
        {
            "title": "Siguiente paso",
            "severity": "info",
            "recommendation": "Conecta una fuente (DB/API/CSV) y automatiza la ingesta cada X minutos.",
            "rationale": "El valor SaaS aparece cuando la plataforma se alimenta sola.",
        }
    )

    return insights


@app.post("/ingest/db_query")
def ingest_db_query(
    data: DBQueryIn,
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    try:
        from sqlalchemy import create_engine as _ce, text as _sql
        ext = _ce(data.connection_url)
        with ext.connect() as conn:
            result = conn.execute(_sql(data.query))
            keys = list(result.keys())
            rows = result.fetchmany(10_000)
        ext.dispose()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Error BD: {exc}")

    inserted = 0
    for row in rows:
        d = dict(zip(keys, row))
        text_val = str(d.get(data.text_column, "")).strip()[:5000]
        if not text_val:
            continue
        label_val: Optional[int] = None
        if data.label_column and data.label_column in d:
            try:
                label_val = int(d[data.label_column])
            except (ValueError, TypeError):
                pass
        session.add(Event(user_id=current.id, text=text_val, label=label_val))
        inserted += 1
    if inserted:
        session.commit()
    return {"inserted": inserted}
