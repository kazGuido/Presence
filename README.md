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
# edit .env — set JWT_SECRET, PUBLIC_APP_URL for WA links, and CORS_ALLOWED_ORIGINS for split frontend/backend dev
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend smoke tests:

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest
```

**Frontend** (from `frontend/`):

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:8000`.

With **`DEMO_SEED=1`** (see Compose / `.env`), first startup seeds **demo-corp**: employer `boss@example.com` / `demo-demo`, multiple employees (PIN **1234**), two work sites, and **past punch history** for analytics — only when that company still has **zero** punches (so existing databases are not overwritten).

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

For **production** behind **Nginx Proxy Manager**, use the canonical deploy so the `api` container joins NPM’s Docker networks (otherwise NPM cannot resolve `api` → **502**):

```bash
./deploy.sh
# or: make deploy
```

See **Production behind Nginx Proxy Manager** below. [`compose.env.example`](compose.env.example) lists `NPM_PROXY_NETWORK` / `NPM_APP_NETWORK` — copy values into your root `.env`.

Services:

- **api** — FastAPI + built UI (port **8000**)
- **worker** — ARQ cron (every 5 minutes) for pre-shift attendance links; uses the same SQLite DB and Redis as the API
- **redis** — verification codes for employee email/WhatsApp confirmation + ARQ broker
- **minio** — object storage for punch photos when configured (API also ensures the bucket exists)
- **whatsapp-bridge** — Baileys HTTP API (port **3005**). **One WhatsApp session per company** (`/t/<company-uuid>/…`); data under `WHATSAPP_DATA_DIR/tenants/<uuid>/`. Employer **Settings → WhatsApp** uses the logged-in company only. Outbound sends use each employee’s `company_id`.

**Migrating an old single `auth_info` folder:** copy its contents to `tenants/<company-id>/` inside the bridge data volume (`company-id` = `companies.id`, e.g. from `GET /api/employer/company` when logged in as that employer).

### Production behind Nginx Proxy Manager (avoid 502)

Deploy with **`./deploy.sh`** (or `make deploy`) so Compose loads **`docker-compose.npm.yml`** as well as [`docker-compose.yml`](docker-compose.yml). That attaches **`api`** to the external networks NPM uses; otherwise NPM cannot resolve hostname **`api`** and you get **502 Bad Gateway**.

**First time on the server**

1. List NPM’s networks: `docker inspect nginx-proxy-manager --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'`
2. Create missing networks if needed, e.g. `docker network create proxy`.
3. Copy [`compose.env.example`](compose.env.example) into root `.env` and set `NPM_PROXY_NETWORK` / `NPM_APP_NETWORK` to match `docker network ls`.

**Nginx Proxy Manager — Proxy Host**

| Field | Value |
|--------|--------|
| Scheme | `http` |
| Forward hostname / IP | `api` or `presence-api` |
| Forward port | `8000` |

Do not use `127.0.0.1` or the host-published port unless NPM uses host networking; inside the NPM container those do not point at this stack.

**Verify from NPM’s container**

```bash
docker exec nginx-proxy-manager curl -fsS http://api:8000/health
```

Expect `{"status":"ok"}`. A few seconds of 502 during `up --build` is normal while `api` restarts.

Use a project `.env` (Compose reads it from the repo root) for secrets and URLs, for example:

- `JWT_SECRET`, `WHATSAPP_BRIDGE_SECRET`
- `NPM_PROXY_NETWORK`, `NPM_APP_NETWORK` — when using **Nginx Proxy Manager**, set these to match Docker network names (see [`compose.env.example`](compose.env.example)) and deploy with `./deploy.sh`
- `PUBLIC_APP_URL` — must be the browser-reachable base URL used in `/attend/...` links (e.g. `http://localhost:8000` when using compose)
- `CORS_ALLOWED_ORIGINS` — comma-separated browser origins allowed to call the API when the frontend is served from a different origin (defaults to Vite dev origins; use `*` only when browser credentials are not needed)
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

UI tokens live in [`frontend/tailwind.config.js`](frontend/tailwind.config.js); product flows are implemented under [`frontend/src/pages`](frontend/src/pages).

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
