# Geofence attendance app

Employer portal (company, employees, work sites, schedules), employee punch in/out with geofence + optional photo, attendance analytics, and WhatsApp validation deep links via a **Baileys** HTTP bridge.

**Stack**: FastAPI + SQLite (backend), Vite + React + TypeScript + Tailwind v4 (frontend), Node bridge for WhatsApp.

## Clone

```bash
git clone https://github.com/<YOUR_USER_OR_ORG>/geofence-attendance-app.git
cd geofence-attendance-app
```

Replace `<YOUR_USER_OR_ORG>` with your GitHub owner after you create the remote repository.

## Local development

**Backend** (from `backend/`):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env — set JWT_SECRET, PUBLIC_APP_URL for WA links
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend** (from `frontend/`):

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:8000`.

## Production (single process)

Build the UI into `backend/app/static`, then run uvicorn (see `Dockerfile`).

```bash
cd frontend && npm ci && npm run build
# copies dist to backend/app/static — Dockerfile does this
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Docker Compose

```bash
docker compose up --build
```

- API + static UI: port **8000**
- WhatsApp bridge: **3005** (scan QR in `docker compose logs whatsapp-bridge`)

Set `WHATSAPP_BRIDGE_URL`, `WHATSAPP_BRIDGE_SECRET`, and `PUBLIC_APP_URL` in `.env` for the API service.

## Design reference

UI tokens align with [`/root/stitch_geofenced_whatsapp_attendance_sync/ivorian_tech_excellence/DESIGN.md`](/root/stitch_geofenced_whatsapp_attendance_sync/ivorian_tech_excellence/DESIGN.md).
