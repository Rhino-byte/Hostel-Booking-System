# Database backups — St. Clare Hostel

The Postgres (or SQLite) database is the sole financial record for hostel bookings and payments. Treat it as critical.

## Local (SQLite)

Database file: `prisma/dev.db`

```bash
# Simple file copy
copy prisma\dev.db backups\dev-%DATE%.db
```

Or on macOS/Linux:

```bash
mkdir -p backups
cp prisma/dev.db "backups/dev-$(date +%Y%m%d).db"
```

## Production (PostgreSQL)

1. Prefer managed provider automated backups (Neon, Supabase, RDS) with at least 7-day retention.
2. Weekly logical dump:

```bash
pg_dump "$DATABASE_URL" --format=custom --file="stclare-$(date +%Y%m%d).dump"
```

3. Test restore quarterly on a staging database.
4. Restrict access: app role with least privilege; admin credentials only for migrations.

## After restore

1. Confirm `Term.isActive` is correct.
2. Spot-check a few payment totals against the secretary's recent Pay Bill alerts (or run **Settings → Sync now** against the Google Sheet).
3. Verify no double-booked beds: active bookings per bed/term must be unique.

## Google Sheet is not a backup

The live Google Sheet is a **mirror / roster register**, not the financial ledger. The app database holds the full payment history (multiple instalments, voids, audit trail). Always back up Postgres/SQLite; do not rely on Sheet1 alone after go-live.
