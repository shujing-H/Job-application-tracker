# Job Application Tracker

A privacy-first Chrome Manifest V3 extension that captures job details into local drafts and only promotes a draft after application success is detected or the user confirms it. It never fills or submits an application.

## First milestone

- React + TypeScript popup UI and an installable Vite/CRXJS development build.
- Page extraction for LinkedIn, Handshake, Workday, and Greenhouse.
- Local-only drafts containing company, role, location, canonical job URL, source, and full job-description snapshot.
- Seven-day retention, grouped reminders on days 3 and 6, automatic removal on day 7, and a seven-day extension action.
- Conservative submission-success phrase detection correlated to the same browser tab, plus explicit **I applied** confirmation.
- A local confirmed-application outbox with fingerprints for duplicate prevention and retry metadata for the future Google Sheets sync.

## Privacy and permissions

The extension requests only `storage`, `alarms`, and `notifications`, plus host access limited to the four supported job platforms. Draft and confirmed data stay in `chrome.storage.local`. No analytics, remote service, broad browsing permission, form filling, or submission capability is included.

## Development

```sh
npm install
npm test
npm run build
```

Load `dist/` from `chrome://extensions` using **Developer mode → Load unpacked**. Run `npm run dev` for iterative development.

## Architecture

```text
job detail page
  → site-specific content extractor
  → service worker message boundary
  → local draft repository
      ├─ hourly alarm → day 3/day 6 notification or day 7 expiry
      └─ explicit/detected success → confirmed outbox (deduplicated)
                                       → Google Sheets adapter (next milestone)
```

The Google Sheets adapter will map confirmed records to these exact English columns:

`Company`, `Role`, `Location`, `Applied Date`, `Source`, `Status`, `Job URL`, `JD Snapshot`, `Notes`

The outbox is deliberately local in this milestone. Its fingerprint and sync state are the seam for idempotent Sheets writes, offline retry, and duplicate prevention without prematurely transmitting drafts.

## Product constraints

- Drafts never reach Google Sheets.
- A confirmed row is created only after a high-confidence success signal or a user action.
- The extension observes; it never fills inputs or clicks submission controls.
- Repository and development artifacts must remain private.
