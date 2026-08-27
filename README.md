# Job Application Tracker

A privacy-first Chrome extension that saves job descriptions while you browse and records only the applications you confirm in your own Google Sheet.

Job listings often disappear or change by the time an interview invitation arrives. Job Application Tracker keeps a local snapshot of each supported job page, reminds you about roles you viewed but have not applied to, and gives you a searchable application history without asking you to copy and paste every job description by hand.

> **Project status:** early beta. The extension is usable locally, but the public Chrome Web Store release and production Google OAuth setup are still in progress.

## What it does

- Captures the company, role, location, source, URL, and job-description snapshot from supported job-detail pages.
- Keeps unconfirmed jobs as local drafts instead of uploading your browsing activity.
- Syncs a row to Google Sheets only after you choose **I applied**, choose **Request referral**, or the extension detects a conservative same-tab success signal.
- Reminds you about unconfirmed drafts on days 3 and 6, then removes them after 7 days unless you extend them.
- Prevents repeated visits to the same job from creating duplicate Sheet rows.
- Tracks referrals and the current application stage, including interview rounds, rejection, offer, and withdrawal.
- Never fills application forms or clicks a job site's submit button.

## Supported sites

- LinkedIn job-detail pages
- Handshake
- Workday
- Greenhouse
- 12twenty school career portals

LinkedIn search-result pages are intentionally excluded because their changing page structure does not expose job details reliably enough. Open the dedicated job-detail page to create a draft.

## How it works

```text
Open a supported job page
        ↓
Save a seven-day draft on this device
        ↓
Confirm “I applied” or “Request referral”
        ↓
Queue the record locally
        ↓
Sync it to your connected Google Sheet
```

Drafts are never sent to Google Sheets. The extension has no application server, analytics service, advertising service, or shared user database.

## Google Sheet format

The extension creates a spreadsheet named **Job Tracker** with an **Applications** worksheet and these columns:

| Column | Purpose |
| --- | --- |
| Company | Employer name |
| Role | Job title |
| Location | Listed location |
| Applied Date | Confirmation date |
| Source | LinkedIn, Handshake, Workday, Greenhouse, or 12twenty |
| Status | `Applied` or `Referral requested` |
| Current Status | Current stage of the application |
| Referral | `Yes` or `No` |
| Job URL | Canonical job-detail link |
| JD Snapshot | Job description captured when the page was viewed |
| Notes | Free-form notes |

`Current Status` includes `Applied`, `Referral requested`, interview rounds 1–3, final round, `Rejected`, `Offer`, and `Withdrawn`.

## Install locally

The extension is not yet generally available in the Chrome Web Store. To try the current beta from source:

### Prerequisites

- Google Chrome
- Node.js and npm
- A Google Cloud project for the OAuth client used by your build

### Build and load the extension

1. Clone the repository and install dependencies:

   ```sh
   git clone https://github.com/shujing-H/Job-application-tracker.git
   cd Job-application-tracker
   npm ci
   ```

2. Follow [Google OAuth setup](docs/GOOGLE_OAUTH_SETUP.md) to create a Chrome Extension OAuth client for your extension ID.

3. Create `.env.local` from the example and add the public OAuth client ID:

   ```sh
   cp .env.example .env.local
   ```

   ```dotenv
   GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

   This is a public client identifier, not a client secret. `.env.local` is ignored by Git.

4. Build and verify the extension:

   ```sh
   npm run verify
   ```

5. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the generated `dist/` directory.

The committed Chrome Web Store public key keeps local builds on the stable extension ID `fiejecpjihcaiglpahoincdmpdjnmmdc`. The manifest audit verifies that ID and the extension's permission boundaries after every build.

## Use the extension

1. Open the extension popup and sign in with Google.
2. Choose **Create “Job Tracker” sheet**.
3. Open a supported job-detail page and check the captured draft in the popup.
4. After applying, select **I applied**. If you plan to contact a connection first, select **Request referral**.
5. Open the connected Sheet to review the new row and update **Current Status** as the process moves forward.

Nothing is submitted to an employer by the extension.

## Privacy and permissions

Job Application Tracker requests only the browser permissions needed for local storage, draft reminders, Google sign-in, supported job pages, and Google Sheets synchronization.

Its Google OAuth scope is `drive.file`, which limits access to spreadsheets created or explicitly opened with this app. It cannot browse or silently read arbitrary files in your Drive. OAuth access tokens remain in Chrome's Identity API cache and are never written to extension storage.

Disconnecting Google or switching the Chrome Google account clears the local drafts, queued records, and Sheet connection before another account can access them.

See the full [privacy and security review](docs/PRIVACY.md) for the data inventory, retention rules, account isolation, and failure behavior.

## Development

```sh
npm ci
npm test
npm run build
npm run audit:manifest
```

Or run the complete verification sequence:

```sh
npm run verify
```

The project uses Chrome Manifest V3, React, TypeScript, Vite, and Vitest. Tests cover extraction, draft lifecycle, account-bound storage, retry behavior, Sheet migration, synchronization, and duplicate protection.

## Beta limitations

- Job-board markup changes over time, so extraction may occasionally need an update.
- LinkedIn capture works on dedicated job-detail pages, not search-result pages.
- Google OAuth test users must be added by the project owner while the hosted beta remains in Testing mode.
- Google OAuth Testing authorizations may expire and require testers to sign in again.
- The public Chrome Web Store listing, hosted homepage, and production OAuth configuration are not complete yet.

For the current testing workflow, see the [beta tester guide](docs/BETA_TESTER_GUIDE.md). Maintainers can use the [release checklist](docs/RELEASE_CHECKLIST.md).

## Contributing

Bug reports and focused pull requests are welcome. When reporting an extraction issue, include the job board, a sanitized job URL if possible, what you expected, and what the extension captured. Please do not include application answers, private correspondence, access tokens, or other personal data.
