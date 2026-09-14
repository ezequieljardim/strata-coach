# Getting run and health data in

`config.ingest.mode` per athlete. Prices and limits below were checked on 14/09/2026 — **check again
before recommending**; they change.

## manual (default, always available)

`/session` asks for distance, duration, average and max HR and cadence if the watch shows them,
then the subjective report. Three runs a week take a minute each. No accounts, no cost, works with
any watch or none.

For trends (sleep, resting HR, weight) the athlete can share a health export every few weeks, or
type a few values; `context.json` accepts `null` anywhere.

## hae — Health Auto Export (iPhone + Mac)

`tools/hae/` fetches the app's daily JSON exports and merges them: per-block HR peaks, cadence,
jogging vs walking minutes, sleep, resting HR, HRV. Full detail in `tools/hae/README.md`.

Requirements to say **before** the athlete sets it up:
- iPhone with iOS 17+, ideally an Apple Watch (without one there's no HR series).
- The app is free, but **automatic exports need Premium**: USD 6.99/year or USD 24.99 lifetime
  (US App Store, 14/09/2026). Basic (USD 2.99) only exports manually.
- A Mac to run `tools/hae/sync-local.sh` (it uses `brctl`, `date -v`).
- A destination: iCloud Drive, Google Drive for desktop, or Google Drive through `rclone` with the
  folder ID in `ingest.hae.driveFolderId`.

Per-athlete calibration in `ingest.hae`: `cadenceOffset`, `jogPaceMaxMinPerKm`, `jogMinCadence`,
`hrTolerance`. Defaults come from one athlete's validation; for a new athlete, compare the first
two or three runs against what they report and adjust **before** history accumulates.

## Strava — not supported

Checked on developers.strava.com (14/09/2026): **a paid Strava subscription is required to create
an API app**, and new apps run in single-player mode where only the owner's account can
authenticate. Each athlete would need their own subscription and their own app, and one person
can't pull a family member's data. Don't send anyone to create an API key without saying this
first — it already cost one athlete a subscription.

If an athlete already pays Strava and wants it, it can be added as an adapter that writes the same
entries `hae.py merge` writes (with `pendingReport: true`).
