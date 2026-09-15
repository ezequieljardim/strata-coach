# Roadmap

Ideas agreed on but not built yet. Order is not a commitment.

## Health Connect (Android) import

Today Android athletes load runs by hand through `/strata:session`; the wizard says automatic
import isn't supported yet.

What's known (checked 15/09/2026):
- Health Connect can export on a schedule (daily/weekly/monthly) to a cloud provider, as a zip.
- Third-party apps export daily JSON to Google Drive (e.g. the open-source
  [healthconnect-export](https://github.com/kas-cor/healthconnect-export)) or activity files
  (FIT/TCX/GPX) plus daily CSV ([Health Sync](https://healthsync.app/about/), paid — price not
  verified).

Likely shape: an ingest adapter `ingest.mode: "files"` that reads activity files (GPX/TCX/FIT) from
a folder and writes sessions the way `tools/hae/hae.py merge` does (`pendingReport: true`), which
would also cover any watch brand; daily context (sleep, resting HR) from Health Connect exports as
a second step. Needs real exported files from an Android user to build and test against.
