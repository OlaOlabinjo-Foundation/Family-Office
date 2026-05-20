# Ola Olabinjo Investment — Family Office Command Centre

Monorepo: **client** (React + Vite), **server** (Express + SQLite).

## Scripts

- `npm run dev` — API + Vite dev servers
- `npm run build` — production client bundle into `client/dist`
- `npm start` — build client then run API (serves `client/dist` when present)
- `npm test` — server Vitest suite
- `npm run seed-user -w server -- <user> "<Display>" <role> "<password>"` — upsert into `app_users` (use with SQLite auth)
- `npm run preview` — production build + Vite preview on **http://localhost:4173** (start API on **8787** first, or `/api` calls fail)

### Testing the frontend (avoid blank pages)

Do **not** run `npx serve .` from the repo root: there is no app `index.html` there, so the browser will not load the React UI.

| Goal | Command | Open in browser |
|------|-----------|------------------|
| **Recommended** — hot reload + API | `npm run dev` | **http://localhost:5173** |
| **Production-like** — one process | `npm start` | **http://localhost:8787** |
| **Preview** — built assets + separate API | Terminal 1: `npm run dev -w server` · Terminal 2: `npm run preview` | **http://localhost:4173** |

## Production setup checklist

1. Copy [`.env.example`](.env.example) and set secrets on the server process.
2. Set `FAMILY_OFFICE_AUTH=sqlite`, seed users, add **email** on each account under **Team users**.
3. Set `JWT_SECRET` and `FAMILY_OFFICE_MFA_KEY`.
4. Configure **SMTP** (`SMTP_URL`, `SMTP_FROM`, `SMTP_TO`) for import alerts, communications follow-up, task owner emails, and digests.
5. Set `APP_BASE_URL` (or `DIGEST_APP_BASE_URL`) so emails contain correct links.
6. Optional: `FAMILY_OFFICE_DIGEST_CRON=1` for automatic weekly task digest (Monday 08:00 server time by default).

## Environment (server)

| Variable | Purpose |
|----------|---------|
| `FAMILY_OFFICE_AUTH` | Set to `sqlite` to load users from the `app_users` table. **Takes priority** over `FAMILY_OFFICE_USERS_JSON`. |
| `FAMILY_OFFICE_USERS_JSON` | Optional JSON array of users with `passwordScrypt`. Ignored when `FAMILY_OFFICE_AUTH=sqlite`. If unset and auth is not sqlite, built-in **demo** users (`*/demo`) are used. |
| `JWT_SECRET` | If set, issues signed session tokens (HS256-style body + HMAC). **Recommended in production.** |
| `FAMILY_OFFICE_MFA_KEY` | Encrypts TOTP secrets at rest (falls back to `JWT_SECRET`). |
| `FAMILY_OFFICE_MFA_REQUIRED` | When `sqlite` auth: lead/analyst must enroll MFA before first full login. Set `0` to disable. Default: required. |
| `FAMILY_OFFICE_SQLITE` | Path to SQLite file, or `:memory:` for tests. |
| `FAMILY_OFFICE_VAULT_DIR` | Directory for document vault uploads (default: `vault` beside the SQLite file). |
| `MASTER_XLSX_PATH` | Optional path to bootstrap workbook when DB is empty. |
| `SMTP_URL`, `SMTP_FROM`, `SMTP_TO` | Email: import success, communication follow-ups, task owner alerts. |
| `SMTP_DIGEST_TO` | Optional separate recipient for weekly task digests (defaults to `SMTP_TO`). |
| `FAMILY_OFFICE_EMAIL_MAP` | JSON map of names/roles to emails, e.g. `{"Lead":"a@b.com","analyst":"c@d.com"}`. |
| `APP_BASE_URL` / `DIGEST_APP_BASE_URL` | Base URL for links in emails (e.g. `https://portal.example.com`). |
| `FAMILY_OFFICE_DIGEST_CRON` | Set to `1` to enable automatic weekly digest (server local clock). |
| `DIGEST_CRON_DOW` | Day of week `0–6` (default `1` = Monday). |
| `DIGEST_CRON_HOUR` | Hour `0–23` (default `8`). |
| `FX_NGN_PER_USD` | NGN per 1 USD for dashboard indicative conversions (default `1600`). |
| `FX_NGN_PER_GBP` | NGN per 1 GBP (default `2050`). |
| `FX_NGN_PER_EUR` | NGN per 1 EUR (default `1750`). |

### SQLite account store (`FAMILY_OFFICE_AUTH=sqlite`)

1. Ensure the server has run at least once so migrations create the `app_users` table.
2. Seed or update users (defaults DB path to `server/data/family-office.sqlite` if `FAMILY_OFFICE_SQLITE` is unset):

```bash
npm run seed-user -w server -- lead "Family Office Lead" lead "YourPassphraseHere"
npm run seed-user -w server -- analyst "Analyst" analyst "YourPassphraseHere"
```

3. Start the API with `FAMILY_OFFICE_AUTH=sqlite` (and the same `FAMILY_OFFICE_SQLITE` path you used for seeding).

Signed-in users can change their password under **Account**. **Lead** users manage **Team users** (add email addresses for task and communication notifications). **Lead** and **analyst** must set up **two-factor authentication** on first login when `FAMILY_OFFICE_MFA_REQUIRED` is active (default).

### Two-factor authentication (MFA)

- Enforced for **lead** and **analyst** when using SQLite auth (unless `FAMILY_OFFICE_MFA_REQUIRED=0`).
- First login walks through QR setup on the sign-in screen; recovery codes are shown once.
- Ongoing sign-in: password, then 6-digit authenticator code (or recovery code).
- Manage later under **Account → Two-factor authentication**.

### Communications & task emails

- **Communications** (sidebar): log calls/emails/meetings; follow-up email goes to Party A, Party B, or both.
- **Task inbox**: owners receive email when new tasks appear, when you assign a task, when calendar items are created, and when analysts submit approvals (lead).
- Requires SMTP and owner emails on team accounts (or `FAMILY_OFFICE_EMAIL_MAP`).

### Production-style passwords (env JSON)

1. Generate a hash: `node server/scripts/hash-password.mjs "YourLongPassword"`
2. Set `FAMILY_OFFICE_USERS_JSON` (single line or use a process manager that loads from file), e.g.:

```json
[
  {
    "username": "lead",
    "displayName": "Family Office Lead",
    "role": "lead",
    "passwordScrypt": "scrypt1$....$...."
  }
]
```

Roles: `chairman`, `lead`, `analyst`, `viewer`.

## Environment (client build)

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Base URL for API (empty = same origin). |
| `VITE_HELP_CENTER_URL` | Optional link shown on **Help** as “Customer hub” (Notion / Google Doc). |

## Customer / team help

After sign-in, open **Help** in the sidebar for a quick start. Use **Account** to change your password when using SQLite auth. Configure `VITE_HELP_CENTER_URL` at build time to surface your shared customer hub link.
