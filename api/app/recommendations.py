from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from sqlmodel import Session, select

from .models import Event


def generate_recommendations(session: Session, limit: int = 10) -> List[Dict[str, Any]]:
    """Very simple rule-based recommendations based on recent events.

    This is intentionally lightweight: you can replace it later with a real
    agent, RAG over your knowledge base, or a more advanced model.
    """
    events = session.exec(select(Event).order_by(Event.id.desc()).limit(limit)).all()

    recs: List[Dict[str, Any]] = []
    for e in events:
        # If the event was labeled as "1" (problem/incident), recommend action.
        if e.label == 1:
            recs.append({
                "event_id": e.id,
                "title": (e.text[:80] + "…") if len(e.text) > 80 else e.text,
                "priority": "alta",
                "action": "Revisa el origen del incidente, valida datos de entrada y genera un plan de mitigación.",
                "created_at": e.created_at.isoformat() if getattr(e, "created_at", None) else None,
            })
        elif e.label == 0:
            recs.append({
                "event_id": e.id,
                "title": (e.text[:80] + "…") if len(e.text) > 80 else e.text,
                "priority": "media",
                "action": "Documenta la resolución y añade una prueba/monitorización para prevenir recurrencias.",
                "created_at": e.created_at.isoformat() if getattr(e, "created_at", None) else None,
            })
        else:
            recs.append({
                "event_id": e.id,
                "title": (e.text[:80] + "…") if len(e.text) > 80 else e.text,
                "priority": "baja",
                "action": "Etiqueta este evento (0/1). Cuantas más etiquetas, mejor aprende el modelo.",
                "created_at": e.created_at.isoformat() if getattr(e, "created_at", None) else None,
            })

    # Add a top-level suggestion
    recs.insert(0, {
        "event_id": None,
        "title": "Siguiente paso recomendado",
        "priority": "alta",
        "action": "Conecta tu base de datos (PostgreSQL/SQL Server) y programa ingestas automáticas (ETL/CDC) para que Atlas aprenda de la operación real.",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return recs
