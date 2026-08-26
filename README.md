# Job Application Tracker

A privacy-first Chrome Manifest V3 extension that keeps job-page drafts on the device and writes only confirmed applications to the signed-in user's Google Sheet. It never fills or submits an application.

## Current milestone

- Chrome Identity OAuth for one Google account per local data boundary.
- Creates a dedicated **Job Tracker** spreadsheet or validates a compatible sheet already authorized for this app.
- Uses these exact columns: `Company`, `Role`, `Location`, `Applied Date`, `Source`, `Status`, `Job URL`, `JD Snapshot`, `Notes`.
- Writes only after high-confidence success detection in the same tab or an explicit **I applied** action.
- Prevents local and remote duplicates with an account-scoped fingerprint and a read-before-append check.
- Retries offline, throttled, authentication, and server failures with bounded backoff.
- Shows disconnected, setup, syncing, retrying, blocked, and up-to-date states in the popup.
- Clears drafts, queued rows, account identity, and sheet configuration when the Chrome Google account changes or disconnects, before a new account can see or sync them.
- Requests only `drive.file`, the Google-recommended narrow OAuth scope for files created or opened with this app.

Draft capture supports LinkedIn, Handshake, Workday, and Greenhouse. Drafts expire after seven days, with grouped reminders on days 3 and 6 and a user-controlled seven-day extension.

## Development and verification

```sh
npm ci
npm run verify
```

`npm run verify` runs the unit tests, TypeScript production build, and an audit of the generated `dist/manifest.json`. Load `dist/` from `chrome://extensions` using **Developer mode → Load unpacked**.

The checked-in OAuth client ID is intentionally nonfunctional. Complete [Google Cloud and OAuth setup](docs/GOOGLE_OAUTH_SETUP.md) and replace it before testing sign-in. The OAuth client ID is public configuration, not a client secret.

## Data flow

```text
supported job page
  → site-specific extractor
  → account-bound local draft (7-day retention)
  → confirmed success only
  → account-bound local outbox
  → identity check + idempotency read
  → that account's connected Google Sheet
```

The access token stays in Chrome's Identity API cache and is never written to extension storage. See [Privacy and security review](docs/PRIVACY.md) for the full data inventory and account-switch analysis.

## Important `drive.file` behavior

The narrow scope can create a new sheet and reopen sheets previously authorized for this OAuth app. It intentionally cannot browse or silently access arbitrary spreadsheets in Drive. If a pasted sheet was never authorized for this app, the popup explains the limitation and offers creation of a new dedicated Job Tracker. This avoids the sensitive all-spreadsheets scope.

## Project constraints

- Drafts never reach Google Sheets.
- A confirmed row is created only after a conservative success signal or explicit user action.
- The extension observes; it never fills inputs or clicks submission controls.
- No analytics, application backend, form access, broad browsing permission, or remote-hosted code is included.
- Repository and development artifacts must remain private.
