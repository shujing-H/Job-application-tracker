import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CapturedJob } from '../domain/model';
import { clearIdentityBoundary, connectAccount, readState, upsertDraft } from './repository';

const memory: Record<string, unknown> = {};
const storage = {
  get: vi.fn(async (keys: string | string[]) => {
    const requested = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(requested.filter((key) => key in memory).map((key) => [key, memory[key]]));
  }),
  set: vi.fn(async (values: Record<string, unknown>) => { Object.assign(memory, values); }),
  remove: vi.fn(async (keys: string | string[]) => {
    for (const key of Array.isArray(keys) ? keys : [keys]) delete memory[key];
  }),
};
vi.stubGlobal('chrome', { storage: { local: storage } });
vi.stubGlobal('crypto', { randomUUID: () => 'draft-id' });

const job: CapturedJob = {
  company: 'Acme', role: 'Engineer', location: '', source: 'LinkedIn',
  jobUrl: 'https://example.com/jobs/1', jdSnapshot: 'Description',
};

describe('account-isolated repository', () => {
  beforeEach(() => {
    for (const key of Object.keys(memory)) delete memory[key];
  });

  it('does not capture any draft before an account is connected', async () => {
    expect(await upsertDraft(job)).toBeUndefined();
    expect((await readState()).drafts).toEqual({});
  });

  it('clears old records when a different account connects', async () => {
    await connectAccount({ accountId: 'one', email: 'one@example.com' });
    await upsertDraft(job);
    const state = await connectAccount({ accountId: 'two', email: 'two@example.com' });
    expect(state.connection?.accountId).toBe('two');
    expect(state.drafts).toEqual({});
    expect(state.applications).toEqual({});
  });

  it('keeps one active draft when the same posting is seen in LinkedIn search and detail views', async () => {
    await connectAccount({ accountId: 'one', email: 'one@example.com' });
    await upsertDraft({ ...job, jobUrl: 'https://www.linkedin.com/jobs/search-results/?currentJobId=123', role: 'First title' });
    await upsertDraft({ ...job, jobUrl: 'https://www.linkedin.com/jobs/view/123?trackingId=abc', role: 'Refined title' });
    const state = await readState();
    expect(Object.values(state.drafts)).toHaveLength(1);
    expect(Object.values(state.drafts)[0]?.jobUrl).toBe('https://www.linkedin.com/jobs/view/123');
  });

  it('clears identity, sheet configuration, drafts, and outbox on disconnect', async () => {
    await connectAccount({ accountId: 'one', email: 'one@example.com' });
    await upsertDraft(job);
    await clearIdentityBoundary();
    const state = await readState();
    expect(state.connection).toBeUndefined();
    expect(state.drafts).toEqual({});
    expect(state.applications).toEqual({});
  });
});
