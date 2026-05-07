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
- **whatsapp-bridge** — Baileys HTTP API (port **3005**). **One WhatsApp session per company** (`/t/<company-uuid>/…`); data under `WHATSAPP_DATA_DIR/tenants/<uuid>/`. Employer **Settings → WhatsApp** uses the logged-in company only. Outbound sends use each employee’s `company_id`.

**Migrating an old single `auth_info` folder:** copy its contents to `tenants/<company-id>/` inside the bridge data volume (`company-id` = `companies.id`, e.g. from `GET /api/employer/company` when logged in as that employer).

Use a project `.env` (Compose reads it from the repo root) for secrets and URLs, for example:

- `JWT_SECRET`, `WHATSAPP_BRIDGE_SECRET`
- `PUBLIC_APP_URL` — must be the browser-reachable base URL used in `/attend/...` links (e.g. `http://localhost:8000` when using compose)
- `FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT_FILE` — optional; required for **native push** to Android/iOS apps (Firebase HTTP v1). Point `FCM_SERVICE_ACCOUNT_FILE` at the service account JSON path inside the container (e.g. mount a read-only volume). Set these on both **`api`** and **`worker`** if you use Compose — reminders run in the worker.
- `SMTP_*` — optional; required to send attendance links or verification codes by email
- `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` — match the MinIO service defaults or your overrides

The API container sets `DATABASE_URL=sqlite:////app/data/app.db` and `UPLOAD_DIR=/app/uploads` so the DB and uploads persist on named volumes.

## Mobile app (Capacitor / Android)

The employee portal can be packaged as a native app:

1. **Firebase**
   - Create a Firebase project, add an **Android** app with package name `com.nicedaytech.presence` (matches [`frontend/capacitor.config.ts`](frontend/capacitor.config.ts)).
   - Download **`google-services.json`** into `frontend/android/app/` (gitignored). Gradle applies the Google Services plugin only when this file exists.
   - Create a **service account** with Firebase Cloud Messaging permissions and download the JSON key for the **API** (`FCM_PROJECT_ID` + `FCM_SERVICE_ACCOUNT_FILE` — see [`backend/.env.example`](backend/.env.example)).

2. **API URL for the WebView**
   - Production API origin must be set at **build time**: copy [`frontend/env.mobile.example`](frontend/env.mobile.example) to `.env.mobile` and set `VITE_API_URL=https://your-api-host` (no trailing slash).
   - Build the bundle: `cd frontend && npm ci && npm run build:mobile`.

3. **Sync & run**
   - `npx cap sync android`
   - Open `frontend/android` in Android Studio, or build from CLI with Android SDK / `ANDROID_HOME` set.
   - Debug APK: `./gradlew assembleDebug` → `frontend/android/app/build/outputs/apk/debug/`.
   - **Release signing**: copy [`frontend/android/keystore.properties.example`](frontend/android/keystore.properties.example) to `frontend/android/keystore.properties`, place your keystore file, then `./gradlew assembleRelease`.

4. **CI**
   - [`.github/workflows/android-build.yml`](.github/workflows/android-build.yml) builds a **debug** APK when `frontend/**` changes (optional repo variable `VITE_API_URL` for the packaged API host).

Push notifications use the same attendance reminder pipeline as email/WhatsApp; employees enable **App push** under Settings and register the device automatically after granting notification permission in the native app.

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
