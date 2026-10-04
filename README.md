# Mio Doctors — Admin Panel

React 19 + Vite + TypeScript. Talks only to the Mio Doctors API (`backend/`).

## Run locally

```bash
cp .env.example .env        # VITE_API_BASE_URL=http://localhost:4000/api/v1
npm install
npm run dev                 # http://localhost:5173
```

The API must allow the origin: `CORS_ORIGINS` in `backend/.env` includes `http://localhost:5173`.

### First admin account

There is no sign-up. Create the first admin from the backend:

```bash
# backend/.env
SEED_ADMIN_EMAIL=you@example.com
SEED_ADMIN_PASSWORD=<at least 12 characters>

cd ../backend && npm run seed
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :5173 |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run typecheck` | TypeScript only |
| `npm run lint` | ESLint |

## Admin team & roles

- **Super Admin** (built-in) can do everything, including *Admin Team & Roles*.
- Other roles are sets of sections (Dashboard, Users, Access, Appointments, Conferences, Billing, Help Desk, Reports, FAQs, Terms, Settings, Audit). Starter roles: Support, Operations, Finance — edit freely.
- New team members get a one-time temporary password and must set their own at first sign-in. "Reset password" does the same again.
- Permissions are checked by the API on every request; changing a role applies immediately. At least one active Super Admin always remains, and nobody can change their own role or status.
- Help desk requests can be assigned (one or many at once) to members whose role includes the Help Desk; they filter by "Assigned to me".

Forgot the owner password? Set `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `backend/.env` and run `npm run admin:password` there.

## Importing doctors (CSV)

Users → **Import doctors (CSV)** → *Download demo sheet* (same file as `backend/docs/samples/doctors_import_template.csv`).

1. Fill one doctor per row, keep the header. Required: `name`, `mobile`, `specialty`, `city`.
2. Save as **CSV UTF-8** and upload. Every row is checked first (format, duplicates in the file and in the database); nothing is saved yet.
3. Click **Import N doctors** — valid rows are created, rows with errors are skipped and listed.

Limits: 1,000 rows / 2 MB per file. Imported doctors sign in with OTP on their mobile and appear in the MR Master MCL; if MR-call days/times are filled in, their registration is complete, otherwise they finish that step in the app.

## Banner management

Banner Management → **Add banner**: title, description, image (JPG/PNG/WEBP, max 2 MB, wide — e.g. 1080×490; preview shows the app shape), optional mobile image, "show title on banner", target audience (all / one state / one city / multiple), tap action (none / app screen / https link), status, start–end dates and priority.

Doctors see banners for their city first, then their state, then "all locations", each ordered by priority (1 = first). *Locations* tab: add cities/states, aliases for other spellings (Bangalore → Bengaluru), deactivate. Requires the **Banners** section in the admin's role.

## Modules

Dashboard · Users (search, detail, activate/deactivate) · Receptionist Access ·
Appointments · Conferences · Banner Management (banners, locations) · Plans & Billing (plans, orders, subscriptions) ·
Help Desk (assignment) · Reports (Excel/CSV export) · FAQs · Terms & Policies · Settings (help desk topics & contacts) · Audit Log · Admin Team & Roles.

## Security notes

- Every `/admin/*` call is checked server-side (`authenticate` + `requireRole('admin')`); the panel hides nothing that the API would otherwise allow.
- Access token is kept in memory only; the refresh token is in `sessionStorage` (per tab, gone when the tab closes). One shared refresh on 401.
- Deactivating a user bumps their token version, so they are signed out immediately on every device.
- All admin changes are written to the audit log (visible, not editable, in the panel).
- For production, serve `dist/` behind HTTPS on its own origin and add that origin to `CORS_ORIGINS`.
