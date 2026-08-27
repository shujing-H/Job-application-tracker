# Release checklist

## Closed beta

- [ ] Collect tester Google account emails.
- [ ] Add each tester under Google Cloud **Audience → Test users**.
- [ ] Share the beta tester guide.
- [ ] Keep the Chrome Web Store listing Private until the beta package and tester access are ready.
- [ ] Record issues by job board and test account.

## Public web presence

- [ ] Choose a domain you control and can verify with Google Search Console.
- [ ] Host `site/index.html` and `site/privacy.html` at public HTTPS URLs on that domain.
- [ ] Add a public support contact to the privacy page.
- [ ] Add the homepage, privacy-policy URL, and support email to the Google OAuth branding configuration.
- [ ] Make the GitHub repository public only when you are comfortable publishing the source and documentation.

## Production Google OAuth

- [ ] Create a separate production Google Cloud project. Keep the existing `job-application-tracker-sjh` project for development/testing.
- [ ] Enable Google Sheets API in the production project.
- [ ] Configure an External production consent screen with the public homepage and privacy-policy URLs.
- [ ] Create a Chrome Extension OAuth client tied to extension ID `fiejecpjihcaiglpahoincdmpdjnmmdc`.
- [ ] Set the production public client ID in local `.env.local`, rebuild, and rerun `npm run verify`.
- [ ] Check whether Google requires brand verification before changing the audience to production.

## Chrome Web Store

- [ ] Build from the production OAuth configuration.
- [ ] Create the ZIP with the *contents* of `dist/` at its root, including `manifest.json`; do not include source files, `node_modules`, or `.env.local`.
- [ ] Add the English store description, 128 × 128 icon, screenshots, privacy-policy URL, and any required disclosure answers.
- [ ] Submit an **Unlisted** release first, with deferred publication if you want to control the launch time.
- [ ] Install the Web Store build on a clean Chrome profile and complete one end-to-end Sheet sync before inviting beta users.

## Public release

- [ ] Resolve beta issues and update the store package.
- [ ] Confirm the production OAuth flow works for an account that was not a test user.
- [ ] Change Web Store visibility from Unlisted to Public and submit the release for review.
- [ ] Monitor support feedback and job-board extraction failures after launch.
