# Google Cloud and OAuth setup

This is the nontechnical release checklist for the person who owns the extension. No OAuth client secret belongs in this repository or in the extension.

## 1. Reserve the Chrome extension ID

1. The Chrome Web Store draft reserves extension ID `fiejecpjihcaiglpahoincdmpdjnmmdc`.
2. The matching Web Store public key is committed in the manifest `key` field, so unpacked builds derive the same ID. It is a public identifier, not a private signing key.
3. The Chrome Extension OAuth client must use exactly `fiejecpjihcaiglpahoincdmpdjnmmdc`.

Changing the extension ID breaks the OAuth client mapping. Chrome's [OAuth manifest documentation](https://developer.chrome.com/docs/extensions/reference/manifest/oauth2) describes the `oauth2` client and stable-ID requirement.

## 2. Create the Google Cloud project

1. Open Google Cloud Console and create a project dedicated to Job Application Tracker.
2. In **APIs & Services → Library**, enable **Google Sheets API**. Drive API is not used by the code and need not be enabled.
3. In **Google Auth Platform**, configure the app name, user-support email, and developer-contact email.
4. Choose the external audience unless distribution is limited to one Google Workspace organization.
5. Add only this scope: `https://www.googleapis.com/auth/drive.file`.

Google documents `drive.file` as the recommended, non-sensitive scope that limits the app to files the user creates or opens with it: [Sheets API scopes](https://developers.google.com/workspace/sheets/api/scopes).

## 3. Create the Chrome Extension OAuth client

1. In **Google Auth Platform → Clients**, create a client of type **Chrome Extension**.
2. Enter the exact Chrome Web Store extension ID from step 1.
3. Copy the resulting client ID. It ends in `.apps.googleusercontent.com` and is public configuration.
4. Copy `.env.example` to `.env.local` and replace its example value. `.env.local` is ignored by Git; never put a client secret, access token, or refresh token there.
5. Run `npm run verify` and inspect `dist/manifest.json` to confirm the client ID and the single `drive.file` scope. A production build can instead receive `GOOGLE_OAUTH_CLIENT_ID` from its build environment.

For local testing while the app is in testing status, add each tester's Google account under **Audience → Test users**. A tester must also be signed into Chrome with the account they intend to use.

## 4. Prepare for public release

Before moving the Google OAuth app to production and submitting the Web Store item:

1. Publish a real product homepage and privacy policy on a domain you control. The privacy policy should match `docs/PRIVACY.md` and the Chrome Web Store privacy disclosures.
2. Verify the domain in Google Search Console, then use that domain for the OAuth homepage, privacy-policy, and terms links.
3. Complete the Google Auth Platform branding, audience, data-access, and verification sections. Keep support/developer contacts current.
4. In the Chrome Extension OAuth client, use **Verify app ownership**. The signed-in Cloud account must be a publisher of the Web Store item with the same extension ID.
5. Supply any Google review materials requested: why `drive.file` is needed, a short authorization-flow video, test instructions, and links to the public policies. The app does not request a restricted scope or store tokens on a server.
6. Complete the Chrome Web Store listing and privacy questionnaire. Disclose job-page content collection, local storage, Google account email/ID, and transfer of confirmed rows to the user's own Google Sheet. Declare that data is not sold, used for advertising, or sent to an application backend.
7. Upload the production ZIP built from `dist/`, keep the item private while testing, then submit it for Web Store review.

Google's current ownership and production guidance is in [OAuth for Chrome extensions](https://developers.google.com/identity/protocols/oauth2/native-app#chrome) and [production readiness](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification).

## 5. Release smoke test

Use two separate test Google accounts in the same Chrome profile and verify all of the following before publishing:

1. Account A signs in, creates a Job Tracker, confirms one application, and sees exactly one row under the nine headers.
2. Confirming the same job again creates no second row.
3. With the network offline, a confirmed application shows retrying; after restoring the network, it syncs once.
4. Disconnect Account A. Confirm that the popup contains no email, sheet link, drafts, or queued applications.
5. Sign into Chrome as Account B and connect it. Account A's records must not appear or sync to Account B's sheet.
6. Change a sheet header and confirm that sync stops with a friendly compatibility error instead of writing into the wrong schema.
7. Restore/reconnect a compatible sheet and confirm blocked rows become eligible to sync again.
