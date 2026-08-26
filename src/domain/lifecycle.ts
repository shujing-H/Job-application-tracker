import type { CapturedJob, ConfirmedApplication, JobDraft, ReminderState } from './model';

const DAY_MS = 24 * 60 * 60 * 1000;
export const RETENTION_DAYS = 7;

export function canonicalizeJobUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith('utm_') || ['trk', 'trackingId', 'ref', 'source'].includes(key)) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  return url.toString();
}

function hash(input: string): string {
  let value = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return (value >>> 0).toString(16).padStart(8, '0');
}

export function jobFingerprint(job: Pick<CapturedJob, 'company' | 'role' | 'jobUrl'>): string {
  const url = canonicalizeJobUrl(job.jobUrl);
  return hash(`${job.company.trim().toLowerCase()}|${job.role.trim().toLowerCase()}|${url}`);
}

export function createDraft(job: CapturedJob, ownerAccountId: string, now = new Date()): JobDraft {
  const timestamp = now.toISOString();
  return {
    ...job,
    ownerAccountId,
    jobUrl: canonicalizeJobUrl(job.jobUrl),
    id: crypto.randomUUID(),
    fingerprint: jobFingerprint(job),
    createdAt: timestamp,
    updatedAt: timestamp,
    expiresAt: new Date(now.getTime() + RETENTION_DAYS * DAY_MS).toISOString(),
    reminderState: {},
  };
}

export function mergeDraft(existing: JobDraft, captured: CapturedJob, now = new Date()): JobDraft {
  return {
    ...existing,
    ...captured,
    jobUrl: canonicalizeJobUrl(captured.jobUrl),
    fingerprint: jobFingerprint(captured),
    updatedAt: now.toISOString(),
  };
}

export type LifecycleResult = {
  expiredIds: string[];
  reminder3: JobDraft[];
  reminder6: JobDraft[];
};

export function evaluateDrafts(drafts: JobDraft[], now = new Date()): LifecycleResult {
  const nowMs = now.getTime();
  const result: LifecycleResult = { expiredIds: [], reminder3: [], reminder6: [] };
  for (const draft of drafts) {
    if (nowMs >= new Date(draft.expiresAt).getTime()) {
      result.expiredIds.push(draft.id);
      continue;
    }
    const age = nowMs - new Date(draft.createdAt).getTime();
    if (age >= 6 * DAY_MS && !draft.reminderState.day6SentAt) result.reminder6.push(draft);
    else if (age >= 3 * DAY_MS && !draft.reminderState.day3SentAt) result.reminder3.push(draft);
  }
  return result;
}

export function markReminded(draft: JobDraft, day: 3 | 6, now = new Date()): JobDraft {
  const reminderState: ReminderState = { ...draft.reminderState };
  reminderState[day === 3 ? 'day3SentAt' : 'day6SentAt'] = now.toISOString();
  return { ...draft, reminderState };
}

export function extendDraft(draft: JobDraft, now = new Date()): JobDraft {
  return {
    ...draft,
    expiresAt: new Date(now.getTime() + RETENTION_DAYS * DAY_MS).toISOString(),
    updatedAt: now.toISOString(),
    reminderState: {},
  };
}

export function confirmDraft(
  draft: JobDraft,
  confirmation: ConfirmedApplication['confirmation'],
  now = new Date(),
): ConfirmedApplication {
  return {
    id: crypto.randomUUID(),
    ownerAccountId: draft.ownerAccountId,
    draftId: draft.id,
    fingerprint: draft.fingerprint,
    company: draft.company,
    role: draft.role,
    location: draft.location,
    jobUrl: draft.jobUrl,
    source: draft.source,
    jdSnapshot: draft.jdSnapshot,
    appliedDate: now.toISOString(),
    status: 'Applied',
    notes: '',
    confirmation,
    sync: { state: 'pending', attempts: 0 },
  };
}
