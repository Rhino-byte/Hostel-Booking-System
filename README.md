# St. Clare's Girls Hostel — Booking & Payment System

Web app for St. Clare's Girls Hostel: public brochure site, parent balance portal, and staff admin for room bookings and manual payment tracking — with live Google Sheets sync for the existing school register.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Prisma + SQLite (local) — switch `provider` to `postgresql` for production
- Firebase Auth OTP (optional) + demo OTP when Firebase is not configured
- Idle-expiring JWT session cookies (`jose`)
- Google Sheets API (`googleapis`) for live roster/payment sync

## Quick start

```bash
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo sign-in (OTP `123456`)

| Role | Phone |
|------|-------|
| Admin | `+254700000001` |
| Secretary | `+254700000002` |
| Matron | `+254700000003` |
| Parent | `+254711111111` |

Students and payments are imported from the Google Sheet after you configure sync and click **Sync now** in Settings.

## Google Sheets sync

The live register is [St.Clare (Google Sheets)](https://docs.google.com/spreadsheets/d/19yH_6N_-HHp47RFZq4Uzdx02RhBIGmdS9W4BVrXpmFc/edit).

### Setup

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project (or use an existing one).
2. Enable the **Google Sheets API**.
3. Create a **service account**, download a JSON key.
4. Share the Google Sheet with the service account email as **Editor**.
5. Add to `.env`:

```env
GOOGLE_SHEETS_ID=19yH_6N_-HHp47RFZq4Uzdx02RhBIGmdS9W4BVrXpmFc
GOOGLE_SHEETS_RANGE=Sheet1!A2:F
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
CRON_SECRET=a-long-random-string
```

6. Sign in as Admin or Secretary → **Settings** → **Sync now**.

### How sync works

| Direction | What |
|-----------|------|
| Pull | Upserts students by `NO` (admission number); imports new DATE+AMOUNT payments; auto-assigns a free bed when `BLOCK` is set (A/B/C/SC) |
| Push | After app payment create/void (and on full sync), writes total paid, latest date/mode, and block letter back to that student's row |

- Sheet wins for **NAME**; app ledger wins for **AMOUNT / DATE / MODE**.
- Cron: every 10 minutes via `vercel.json` → `GET /api/cron/sync` with `Authorization: Bearer $CRON_SECRET`.

### Block mapping

| Sheet BLOCK | Residence |
|-------------|-----------|
| A | Residence A (bunk) |
| B | Residence B |
| C | Residence C |
| SC / S / SELF | Self-Contained |
| blank | Unbooked until assigned in the app |

## Environment

Copy `.env.example` to `.env`. Key variables:

- `DATABASE_URL` — SQLite file or Postgres URL
- `JWT_SECRET` — session signing secret
- `SESSION_IDLE_MS` — idle timeout (default 15 minutes)
- Firebase client + admin vars — leave empty and keep `NEXT_PUBLIC_DEMO_AUTH=true` for local demo
- `GOOGLE_*` / `CRON_SECRET` — sheet sync (see above)

## Scripts

- `npm run dev` — development server
- `npm run build` / `npm start` — production
- `npm run db:push` — sync Prisma schema
- `npm run db:seed` — seed residences, beds, demo users (roster comes from the sheet)
- `npm run db:studio` — Prisma Studio

## Features

- Public: home, residences (compare), amenities, contact
- Admin: dashboard charts, students, interactive hostel map, payment side-sheet, reports/CSV, settings/audit
- Parent: OTP login, balance ring, payment timeline, printable statement
- Live Google Sheet sync (manual + cron)
- Sessions expire after idle; OTP required again

## Production notes

1. Set `provider = "postgresql"` in `prisma/schema.prisma` and point `DATABASE_URL` at managed Postgres.
2. Configure Firebase Phone Auth + Admin SDK; set `NEXT_PUBLIC_DEMO_AUTH=false`.
3. Rotate `JWT_SECRET` and enable HTTPS (secure cookies).
4. Configure Google service account + sheet sharing; set `CRON_SECRET` for Vercel Cron.
5. Schedule Postgres backups — this is the hostel financial record of truth (see `docs/BACKUP.md`).
