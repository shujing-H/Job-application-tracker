import { describe, expect, it, vi } from 'vitest';
import type { CapturedJob, JobDraft } from './model';
import { canonicalizeJobUrl, confirmDraft, createDraft, evaluateDrafts, extendDraft, jobFingerprint } from './lifecycle';

const job: CapturedJob = {
  company: 'Acme', role: 'Engineer', location: 'New York', source: 'LinkedIn',
  jobUrl: 'https://www.linkedin.com/jobs/view/123?utm_source=email&trk=feed', jdSnapshot: 'A full description',
};

describe('draft lifecycle', () => {
  it('normalizes tracking parameters and makes stable fingerprints', () => {
    expect(canonicalizeJobUrl(job.jobUrl)).toBe('https://www.linkedin.com/jobs/view/123');
    expect(jobFingerprint(job)).toBe(jobFingerprint({ ...job, jobUrl: 'https://www.linkedin.com/jobs/view/123' }));
    expect(canonicalizeJobUrl('https://www.linkedin.com/jobs/search-results/?currentJobId=123&trackingId=abc'))
      .toBe('https://www.linkedin.com/jobs/view/123');
  });

  it('retains drafts for seven days and emits day 3/day 6 reminders once', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'draft-id' });
    const start = new Date('2026-08-01T00:00:00Z');
    const draft = createDraft(job, 'account-1', start);
    expect(evaluateDrafts([draft], new Date('2026-08-04T00:00:00Z')).reminder3).toHaveLength(1);
    const day3Sent: JobDraft = { ...draft, reminderState: { day3SentAt: '2026-08-04T00:00:00Z' } };
    expect(evaluateDrafts([day3Sent], new Date('2026-08-07T00:00:00Z')).reminder6).toHaveLength(1);
    expect(evaluateDrafts([draft], new Date('2026-08-08T00:00:00Z')).expiredIds).toEqual(['draft-id']);
  });

  it('extension resets retention/reminders and confirmation starts a sync-safe outbox item', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'generated-id' });
    const draft = { ...createDraft(job, 'account-1', new Date('2026-08-01T00:00:00Z')), reminderState: { day3SentAt: 'x' } };
    const extended = extendDraft(draft, new Date('2026-08-06T00:00:00Z'));
    expect(extended.expiresAt).toBe('2026-08-13T00:00:00.000Z');
    expect(extended.reminderState).toEqual({});
    expect(confirmDraft(extended, 'manual').sync).toEqual({ state: 'pending', attempts: 0 });
    expect(confirmDraft(extended, 'manual', true)).toMatchObject({
      status: 'Referral requested',
      referral: true,
    });
  });
});

describe('12twenty URL identity', () => {
  it('preserves the posting ID while removing institution view parameters', () => {
    expect(canonicalizeJobUrl('https://school.12twenty.com/jobPostings#/jobPostings/35006705580910?p=false'))
      .toBe('https://school.12twenty.com/jobPostings#/jobPostings/35006705580910');
  });

  it('keeps different 12twenty postings distinct', () => {
    expect(canonicalizeJobUrl('https://school.12twenty.com/jobPostings#/jobPostings/101?p=false'))
      .not.toBe(canonicalizeJobUrl('https://school.12twenty.com/jobPostings#/jobPostings/202?p=false'));
  });
});
