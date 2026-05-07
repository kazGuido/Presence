# Geofence attendance app

Employer portal (company, employees, work sites, schedules), employee punch in/out with geofence + optional photo, attendance analytics, and WhatsApp validation deep links via a **Baileys** HTTP bridge.

**Stack**: FastAPI + SQLite (backend), Vite + React + TypeScript + Tailwind (frontend), Redis + ARQ worker (scheduled reminders), MinIO (optional punch photos), SMTP (optional email), Node bridge for WhatsApp (Baileys).

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

The root **`Dockerfile`** is multi-stage: it runs `npm run build` in the frontend image, copies the Vite output into **`backend/app/static`**, then builds the Python image. The **`api`** container runs **uvicorn** only; it serves **`/api/*`**, mounts **`/uploads`** for local files, and serves the **SPA** (static assets + `index.html` fallback) on the same origin — so **one URL** (e.g. `http://localhost:8000`) is the full app after compose is up.

```bash
docker compose up --build
```

Services:

- **api** — FastAPI + built UI (port **8000**)
- **worker** — ARQ cron (every 5 minutes) for pre-shift attendance links; uses the same SQLite DB and Redis as the API
- **redis** — verification codes for employee email/WhatsApp confirmation + ARQ broker
- **minio** — object storage for punch photos when configured (API also ensures the bucket exists)
- **whatsapp-bridge** — Baileys HTTP sender (port **3005**; scan QR in `docker compose logs whatsapp-bridge`)

Use a project `.env` (Compose reads it from the repo root) for secrets and URLs, for example:

- `JWT_SECRET`, `WHATSAPP_BRIDGE_SECRET`
- `PUBLIC_APP_URL` — must be the browser-reachable base URL used in `/attend/...` links (e.g. `http://localhost:8000` when using compose)
- `SMTP_*` — optional; required to send attendance links or verification codes by email
- `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` — match the MinIO service defaults or your overrides

The API container sets `DATABASE_URL=sqlite:////app/data/app.db` and `UPLOAD_DIR=/app/uploads` so the DB and uploads persist on named volumes.

## Design reference

UI tokens align with [`/root/stitch_geofenced_whatsapp_attendance_sync/ivorian_tech_excellence/DESIGN.md`](/root/stitch_geofenced_whatsapp_attendance_sync/ivorian_tech_excellence/DESIGN.md).

## Créer le dépôt GitHub et pousser

```bash
cd geofence-attendance-app
gh auth login
gh repo create geofence-attendance-app --private --description "Geofenced attendance: employers, punch in/out, WhatsApp Baileys, FastAPI + React" --source=. --remote=origin --push
```

Sans `gh` : créez un dépôt vide `geofence-attendance-app` sur GitHub, puis :

```bash
git remote add origin https://github.com/VOTRE_COMPTE/geofence-attendance-app.git
git push -u origin main
```
