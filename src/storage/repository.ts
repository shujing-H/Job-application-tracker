import { EMPTY_STATE, type CapturedJob, type ConfirmedApplication, type JobDraft, type TrackerState } from '../domain/model';
import { confirmDraft, createDraft, extendDraft, jobFingerprint, mergeDraft } from '../domain/lifecycle';

const STORAGE_KEY = 'trackerStateV1';

export async function readState(): Promise<TrackerState> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as TrackerState | undefined) ?? structuredClone(EMPTY_STATE);
}

async function writeState(state: TrackerState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

export async function upsertDraft(captured: CapturedJob): Promise<JobDraft> {
  const state = await readState();
  const fingerprint = jobFingerprint(captured);
  const existing = Object.values(state.drafts).find((draft) => draft.fingerprint === fingerprint);
  const draft = existing ? mergeDraft(existing, captured) : createDraft(captured);
  state.drafts[draft.id] = draft;
  await writeState(state);
  return draft;
}

export async function deleteDraft(id: string): Promise<void> {
  const state = await readState();
  delete state.drafts[id];
  await writeState(state);
}

export async function extendStoredDraft(id: string): Promise<JobDraft | undefined> {
  const state = await readState();
  const draft = state.drafts[id];
  if (!draft) return undefined;
  const extended = extendDraft(draft);
  state.drafts[id] = extended;
  await writeState(state);
  return extended;
}

export async function confirmStoredDraft(
  id: string,
  confirmation: ConfirmedApplication['confirmation'],
): Promise<ConfirmedApplication | undefined> {
  const state = await readState();
  const draft = state.drafts[id];
  if (!draft) return undefined;
  const duplicate = Object.values(state.applications).find((application) => application.fingerprint === draft.fingerprint);
  if (duplicate) {
    delete state.drafts[id];
    await writeState(state);
    return duplicate;
  }
  const application = confirmDraft(draft, confirmation);
  state.applications[application.id] = application;
  delete state.drafts[id];
  await writeState(state);
  return application;
}

export async function replaceDrafts(drafts: Record<string, JobDraft>): Promise<void> {
  const state = await readState();
  state.drafts = drafts;
  await writeState(state);
}
