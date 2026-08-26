# Privacy and security review

Review date: 2026-08-26

## Data inventory

| Data | Where it exists | When it leaves the device | Retention |
| --- | --- | --- | --- |
| Company, role, location, job URL, source, JD snapshot | Account-bound `chrome.storage.local` draft | Never as a draft | 7 days, unless extended or deleted |
| Confirmed application or referral request plus date, status, referral flag, notes | Account-bound local outbox; then the user's connected sheet | Only after detected or manual confirmation | Local until disconnect/account change; sheet retention is controlled by the user |
| Google account stable ID and email | Current local connection record | Never sent to an application backend | Until disconnect/account change |
| Spreadsheet ID, URL, and worksheet title | Current local connection record | Used only in requests to Google Sheets API | Until disconnect/account change |
| OAuth access token | Chrome Identity API cache | Sent only to Google's API | Controlled by Chrome; never stored by this extension |

There is no extension-operated server, analytics service, advertising service, telemetry endpoint, or cross-user database.

## Account isolation

- Every draft and confirmed application carries the current Chrome Google account's stable account ID.
- Reads, mutations, duplicate checks, and sync select records for that exact ID only.
- Before showing state, capturing a job, confirming a draft, maintaining drafts, or syncing, the service worker compares the current Chrome profile identity with the stored owner.
- A mismatch or sign-out clears local drafts, queued/synced application records, email, spreadsheet configuration, sync status, cached OAuth authorization, and session tab-to-draft references.
- Connecting a different account also resets the entire local state before recording the new identity.
- A sync already in flight holds Account A's token and Account A's sheet ID. It cannot retarget Account B; account-scoped repository updates reject stale completion writes.

This policy chooses privacy over cross-account recovery. Unsynced records are deliberately discarded on disconnect or account switch.

## Write and duplicate controls

- Job detection creates only a local draft.
- A row becomes eligible only after a conservative same-tab success phrase, the explicit **I applied** button, or the explicit **Request referral** button.
- Local duplicate protection is scoped by account and fingerprints normalized company, role, and canonical job URL.
- Before every append, the adapter rereads columns A–J for the same job and searches project-visible developer metadata for the same outbox record. The row and its metadata marker are written together in one atomic Sheets batch, so a lost response can be retried without appending again.
- The adapter safely upgrades its previous nine-column sheet by adding the `Referral` header; it otherwise refuses to read or append when headers do not match exactly.
- A single in-memory sync promise prevents overlapping service-worker sync loops.

## Failure behavior

- Offline, timeout, throttling, expired-token, and Google 5xx errors retry after 1, 5, 15, 60, then 360 minutes. A 401 first invalidates Chrome's cached token and retries once immediately; **Sync now** can safely override a scheduled backoff.
- Permanent permission, missing-sheet, or schema errors block that record and show a friendly error.
- Reconnecting a compatible sheet makes blocked records pending again.
- OAuth access tokens are removed from Chrome's cache after a 401 and reacquired through Chrome Identity; they are never copied into storage or logs.

## Permission review

| Permission | Reason |
| --- | --- |
| `storage` | Account-bound drafts, outbox, connection, and sync status |
| `alarms` | Draft retention/reminders and retry scheduling |
| `notifications` | Grouped day-3/day-6 draft reminders |
| `identity` | Chrome-native Google OAuth token flow |
| `identity.email` | Stable account ID/email used to enforce the local account boundary |
| Supported-site hosts | Run the extractor only on LinkedIn, Handshake, Workday, and Greenhouse job pages |
| `https://sheets.googleapis.com/*` | Create, validate, read, and append to the connected sheet |
| OAuth `drive.file` | Access only sheets created/opened with this app; no arbitrary Drive browsing |

The generated-manifest audit fails if broad permissions such as `tabs`, `history`, `cookies`, `debugger`, `webRequest`, or `<all_urls>` appear, or if the OAuth scope expands.

## Residual risks and mitigations

- Site markup and success text can change. Detection is conservative, remains tab-correlated, and users can delete drafts or confirm manually.
- A user can manually create duplicate-looking rows or alter sheet values. The extension uses the stable job fingerprint and stops on header changes, but does not lock the user's sheet.
- The account-switch guarantee depends on Chrome Identity reporting the active profile account. Identity is checked on popup reads and every sensitive operation, and the one-minute sync alarm detects idle changes.
- `chrome.storage.local` is local extension storage, not an encrypted vault. The supported privacy boundary is the signed-in Chrome account inside this extension; a person with OS-level access to the same Chrome profile may inspect extension data before the next identity check.
