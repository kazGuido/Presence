# Presence demo runbook

Use this runbook for customer or investor demos after starting the app with `DEMO_SEED=1`.

## Demo credentials

- Employer: `boss@example.com` / `demo-demo`
- Company slug: `demo-corp`
- Employee PIN for seeded employees: `1234`

## Role flows

### 1. SaaS owner / hosted deployment story

1. Show the README deployment model: shared multi-tenant SaaS by `company_id`, with a dedicated hosted deployment using the same container stack.
2. Highlight PostgreSQL, Redis, MinIO, worker, and WhatsApp bridge in Compose.
3. Explain upsell modules: physical kiosk/borne mode, WhatsApp pairing, push notifications, exports, and dedicated hosting.

### 2. Employer / manager

1. Log in as the employer.
2. Open **Dashboard** and show attendance health over the seeded range.
3. Export daily attendance CSV, then export punch-level CSV.
4. Open **Sites** and show geofence radius management.
5. Open **Employees** and show default site, notification channels, magic links, and kiosk permission.
6. Open **Settings** and show channel policy toggles plus WhatsApp pairing status.

### 3. Supervisor

1. Open **Reviews**.
2. Filter pending geofence warnings.
3. Open a pending out-of-zone/photo-only punch.
4. Add a note and approve or reject it.
5. Open **Journal** and show the immutable audit event.

### 4. Employee

1. Sign in with company slug, employee UUID, and PIN.
2. Open **Clock** and show the current punch action.
3. Show GPS/photo fallback messaging.
4. Open **History** and point out flagged vs OK punches.
5. Open **Settings** and show contact preferences plus in-app notifications from supervisor reviews.

### 5. Kiosk / borne

1. Log in as the demo employee that has kiosk hosting enabled.
2. Open **Kiosk** and show the host QR flow.
3. Explain two modes:
   - colleagues scan the QR with their own signed-in phones;
   - manual selfie punch for colleagues without a device.
4. Explain that photo/manual kiosk punches go to supervisor review before payroll/export decisions.

## Demo close

Summarize the operational promise:

- employees can always record evidence;
- supervisors review exceptions instead of losing attendance events;
- employers get audit, exports, and channel flexibility;
- SaaS can upsell dedicated hosting, physical kiosks, WhatsApp, push, and advanced exports.
