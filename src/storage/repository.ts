import {
  EMPTY_STATE,
  type CapturedJob,
  type ConfirmedApplication,
  type GoogleConnection,
  type JobDraft,
  type SyncSummary,
  type TrackerState,
} from '../domain/model';
import { canonicalizeJobUrl, confirmDraft, createDraft, extendDraft, mergeDraft } from '../domain/lifecycle';

export const STORAGE_KEY = 'trackerStateV2';
const LEGACY_STORAGE_KEY = 'trackerStateV1';

let mutationQueue = Promise.resolve();

function freshState(): TrackerState {
  return structuredClone(EMPTY_STATE);
}

function resetState(state: TrackerState): void {
  delete state.connection;
  state.drafts = {};
  state.applications = {};
  state.syncSummary = { state: 'disconnected' };
}

export async function readState(): Promise<TrackerState> {
  const stored = await chrome.storage.local.get([STORAGE_KEY, LEGACY_STORAGE_KEY]);
  const state = stored[STORAGE_KEY] as TrackerState | undefined;
  if (state) return state;

  // V1 records were not bound to a Google identity. Retaining them across an
  // upgrade could expose one person's drafts to the next profile account.
  if (stored[LEGACY_STORAGE_KEY]) await chrome.storage.local.remove(LEGACY_STORAGE_KEY);
  return freshState();
}

async function writeState(state: TrackerState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

async function mutate<T>(operation: (state: TrackerState) => T | Promise<T>): Promise<T> {
  let result!: T;
  const run = mutationQueue.then(async () => {
    const state = await readState();
    result = await operation(state);
    await writeState(state);
  });
  mutationQueue = run.then(() => undefined, () => undefined);
  await run;
  return result;
}

export async function connectAccount(account: Pick<GoogleConnection, 'accountId' | 'email'>): Promise<TrackerState> {
  return mutate((state) => {
    if (state.connection?.accountId !== account.accountId) resetState(state);
    state.connection = {
      ...(state.connection?.accountId === account.accountId ? state.connection : {}),
      ...account,
      connectedAt: new Date().toISOString(),
    };
    state.syncSummary = state.connection.spreadsheetId
      ? { state: 'ready' }
      : { state: 'needs_sheet', message: 'Create or connect a compatible Job Tracker sheet.' };
    return structuredClone(state);
  });
}

export async function attachSpreadsheet(details: {
  spreadsheetId: string;
  spreadsheetUrl: string;
  worksheetTitle: string;
  worksheetId: number;
}): Promise<TrackerState> {
  return mutate((state) => {
    if (!state.connection) throw new Error('Connect a Google account first.');
    Object.assign(state.connection, details);
    for (const application of Object.values(state.applications)) {
      if (application.ownerAccountId === state.connection.accountId && application.sync.state === 'blocked') {
        application.sync = { ...application.sync, state: 'pending', nextAttemptAt: undefined, lastError: undefined };
      }
    }
    state.syncSummary = { state: 'ready', message: 'Google Sheets is connected.' };
    return structuredClone(state);
  });
}

export async function detachSpreadsheet(): Promise<TrackerState> {
  return mutate((state) => {
    if (!state.connection) throw new Error('Connect a Google account first.');
    delete state.connection.spreadsheetId;
    delete state.connection.spreadsheetUrl;
    delete state.connection.worksheetTitle;
    delete state.connection.worksheetId;
    state.syncSummary = { state: 'needs_sheet', message: 'Create or connect a compatible Job Tracker sheet.' };
    return structuredClone(state);
  });
}

export async function clearIdentityBoundary(message = 'Google account disconnected. Local records were cleared.'): Promise<void> {
  await mutate((state) => {
    resetState(state);
    state.syncSummary = { state: 'disconnected', message };
  });
}

export async function setSyncSummary(
  ownerAccountId: string,
  spreadsheetId: string,
  summary: SyncSummary,
): Promise<void> {
  await mutate((state) => {
    if (state.connection?.accountId === ownerAccountId && state.connection.spreadsheetId === spreadsheetId) {
      state.syncSummary = summary;
    }
  });
}

export async function upsertDraft(captured: CapturedJob): Promise<JobDraft | undefined> {
  return mutate((state) => {
    const accountId = state.connection?.accountId;
    if (!accountId) return undefined;
    const canonicalUrl = canonicalizeJobUrl(captured.jobUrl);
    const existing = Object.values(state.drafts).find(
      (draft) => draft.ownerAccountId === accountId && canonicalizeJobUrl(draft.jobUrl) === canonicalUrl,
    );
    const draft = existing ? mergeDraft(existing, captured) : createDraft(captured, accountId);
    state.drafts[draft.id] = draft;
    return structuredClone(draft);
  });
}

export async function deleteDraft(id: string): Promise<void> {
  await mutate((state) => {
    if (state.drafts[id]?.ownerAccountId === state.connection?.accountId) delete state.drafts[id];
  });
}

export async function extendStoredDraft(id: string): Promise<JobDraft | undefined> {
  return mutate((state) => {
    const draft = state.drafts[id];
    if (!draft || draft.ownerAccountId !== state.connection?.accountId) return undefined;
    const extended = extendDraft(draft);
    state.drafts[id] = extended;
    return structuredClone(extended);
  });
}

export async function confirmStoredDraft(
  id: string,
  confirmation: ConfirmedApplication['confirmation'],
  referral = false,
): Promise<ConfirmedApplication | undefined> {
  return mutate((state) => {
    const draft = state.drafts[id];
    const accountId = state.connection?.accountId;
    if (!draft || !accountId || draft.ownerAccountId !== accountId) return undefined;
    const duplicate = Object.values(state.applications).find(
      (application) => application.ownerAccountId === accountId
        && canonicalizeJobUrl(application.jobUrl) === canonicalizeJobUrl(draft.jobUrl),
    );
    if (duplicate) {
      delete state.drafts[id];
      return structuredClone(duplicate);
    }
    const application = confirmDraft(draft, confirmation, referral);
    state.applications[application.id] = application;
    delete state.drafts[id];
    return structuredClone(application);
  });
}

export async function replaceDrafts(drafts: Record<string, JobDraft>): Promise<void> {
  await mutate((state) => {
    const accountId = state.connection?.accountId;
    state.drafts = Object.fromEntries(
      Object.entries(drafts).filter(([, draft]) => draft.ownerAccountId === accountId),
    );
  });
}

export async function updateApplication(
  id: string,
  ownerAccountId: string,
  spreadsheetId: string,
  update: (application: ConfirmedApplication) => ConfirmedApplication,
): Promise<void> {
  await mutate((state) => {
    const application = state.applications[id];
    if (!application || application.ownerAccountId !== ownerAccountId
      || state.connection?.spreadsheetId !== spreadsheetId) return;
    state.applications[id] = update(application);
  });
}
