# Atlas AI by BlackholeAI (demo local)

Incluye:
- Web (Vite + React) con login **idéntico en estilo** al anterior y **checkbox RGPD** obligatorio.
- API (FastAPI + SQLModel) con bootstrap de org + admin por variables de entorno.
- Postgres 16.

## Arranque

```bash
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

Web: http://localhost:5173
API: http://localhost:8000 (sin /docs ni /openapi.json)

## Credenciales bootstrap

Por defecto en `docker-compose.yml`:
- email: `admin@blackholeai.es`
- password: `AtlasAI#2026!`

## RGPD

En login y registro es obligatorio marcar la casilla.
La política completa está en `/privacy`.

## Ubicaciones clave

- Checkbox RGPD (UI): `web/src/pages/Login.tsx` y `web/src/pages/Register.tsx`
- Texto de política: `web/src/pages/Privacy.tsx`
- Persistencia del consentimiento: `api/app/models.py` (campos `rgpd_accepted`, `rgpd_accepted_at`)
- Validación en API: `api/app/main.py` (`/auth/login`, `/auth/register`)
- API sin OpenAPI JSON: `api/app/main.py` (`openapi_url=None`)
