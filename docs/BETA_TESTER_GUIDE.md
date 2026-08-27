# Job Application Tracker beta tester guide

Thank you for testing Job Application Tracker. The extension records job details locally and syncs only records you confirm to your own Google Sheet. It never fills out or submits an application.

## Before you start

1. Send the project owner the Google account email you will use for testing.
2. Install the beta extension from the Chrome Web Store link provided by the project owner.
3. Open the extension and sign in with that same Google account.
4. Choose **Create “Job Tracker” sheet**. Do not connect a manually created spreadsheet; the beta uses a privacy-preserving Google permission that only grants access to sheets created or previously authorized by the extension.

## Test flow

1. Open a job-detail page on LinkedIn, Handshake, Workday, or Greenhouse.
2. Open the extension and check that the company, role, location, and source look right.
3. For a normal application, choose **I applied**. For a networking-first opportunity, choose **Request referral**.
4. Open the connected Google Sheet and verify that exactly one row appears.
5. Test the **Current Status** dropdown in the Sheet. Try `Interview – Round 1`, `Rejected`, or `Offer`.
6. Reopen the same job-detail URL and confirm it again. The Sheet should not receive a duplicate row.

## Please report

- the job-board URL (remove private tracking details if preferred);
- what you expected and what happened;
- a screenshot of the extension popup or Chrome extension error, if available;
- whether your Sheet created a row, a duplicate row, or no row.

## Important beta limitations

- LinkedIn capture currently runs only on dedicated job-detail pages, not search-result pages.
- In the Google OAuth testing phase, the project owner must add your email as a test user before you can sign in.
