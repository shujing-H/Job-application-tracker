import { evaluateDrafts, markReminded } from '../domain/lifecycle';
import type { CapturedJob, JobDraft } from '../domain/model';
import {
  assertCurrentAccount,
  connectGoogleIdentity,
  disconnectGoogleIdentity,
  getSilentIdentity,
  IdentityBoundaryError,
  removeCachedToken,
} from '../google/identity';
import { isRetryableStatus, retryDelayMs } from '../google/retry';
import {
  appendApplicationIdempotently,
  createJobTrackerSheet,
  SheetsApiError,
  validateCompatibleSheet,
} from '../google/sheets';
import {
  attachSpreadsheet,
  clearIdentityBoundary,
  confirmStoredDraft,
  connectAccount,
  deleteDraft,
  detachSpreadsheet,
  extendStoredDraft,
  readState,
  replaceDrafts,
  setSyncSummary,
  updateApplication,
  upsertDraft,
} from '../storage/repository';

const MAINTENANCE_ALARM = 'draft-maintenance';
const SYNC_ALARM = 'sheets-sync';
let syncInFlight: Promise<void> | undefined;

chrome.runtime.onInstalled.addListener(() => {
  void chrome.alarms.create(MAINTENANCE_ALARM, { delayInMinutes: 1, periodInMinutes: 60 });
  void chrome.alarms.create(SYNC_ALARM, { delayInMinutes: 1, periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(() => {
  void runMaintenance();
  void requestSync();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === MAINTENANCE_ALARM) void runMaintenance();
  if (alarm.name === SYNC_ALARM) void requestSync();
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  void handleMessage(message, sender.tab?.id)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error: unknown) => sendResponse({ ok: false, error: friendlyError(error) }));
  return true;
});

function friendlyError(error: unknown): string {
  if (error instanceof SheetsApiError && error.status === 403) {
    return 'Google did not grant this extension access to that sheet. With the privacy-preserving drive.file scope, create a new Job Tracker or reconnect one previously created by this extension.';
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

async function enforceIdentityBoundary(): Promise<boolean> {
  const state = await readState();
  if (!state.connection) return false;
  try {
    await assertCurrentAccount(state.connection.accountId);
    return true;
  } catch (error) {
    if (!(error instanceof IdentityBoundaryError)) throw error;
    await disconnectGoogleIdentity();
    await clearIdentityBoundary('The Chrome Google account changed or disconnected. Local drafts and queued records were cleared before another account could receive them.');
    await chrome.storage.session.clear();
    return false;
  }
}

async function handleMessage(message: unknown, tabId?: number): Promise<unknown> {
  if (!message || typeof message !== 'object' || !('type' in message)) return undefined;
  if (message.type === 'GET_STATE') {
    const state = await readState();
    if (state.connection) await enforceIdentityBoundary();
    return readState();
  }
  if (message.type === 'CONNECT_GOOGLE') {
    const previousAccountId = (await readState()).connection?.accountId;
    const identity = await connectGoogleIdentity();
    if (previousAccountId && previousAccountId !== identity.accountId) await chrome.storage.session.clear();
    return connectAccount(identity);
  }
  if (message.type === 'CREATE_SHEET') {
    if (!(await enforceIdentityBoundary())) return readState();
    const state = await readState();
    if (!state.connection) throw new Error('Connect a Google account first.');
    const identity = await getSilentIdentity(state.connection.accountId);
    const sheet = await createJobTrackerSheet(identity.token);
    const next = await attachSpreadsheet(sheet);
    void requestSync();
    return next;
  }
  if (message.type === 'CONNECT_SHEET' && 'input' in message && typeof message.input === 'string') {
    if (!(await enforceIdentityBoundary())) return readState();
    const state = await readState();
    if (!state.connection) throw new Error('Connect a Google account first.');
    const identity = await getSilentIdentity(state.connection.accountId);
    const sheet = await validateCompatibleSheet(identity.token, message.input);
    const next = await attachSpreadsheet(sheet);
    void requestSync();
    return next;
  }
  if (message.type === 'DISCONNECT_GOOGLE') {
    await disconnectGoogleIdentity();
    await clearIdentityBoundary();
    await chrome.storage.session.clear();
    return readState();
  }
  if (message.type === 'CHANGE_SHEET') {
    if (!(await enforceIdentityBoundary())) return readState();
    return detachSpreadsheet();
  }
  if (message.type === 'SYNC_NOW') {
    await requestSync();
    return readState();
  }
  if (message.type === 'DELETE_DRAFT' && 'id' in message && typeof message.id === 'string') {
    if (!(await enforceIdentityBoundary())) return readState();
    await deleteDraft(message.id);
    return readState();
  }
  if (message.type === 'EXTEND_DRAFT' && 'id' in message && typeof message.id === 'string') {
    if (!(await enforceIdentityBoundary())) return readState();
    await extendStoredDraft(message.id);
    return readState();
  }
  if (message.type === 'CONFIRM_DRAFT' && 'id' in message && typeof message.id === 'string') {
    if (!(await enforceIdentityBoundary())) return readState();
    await confirmStoredDraft(message.id, 'manual');
    void requestSync();
    return readState();
  }
  if (message.type === 'JOB_DETECTED' && 'job' in message) {
    if (!(await enforceIdentityBoundary())) return undefined;
    const draft = await upsertDraft(message.job as CapturedJob);
    if (draft && tabId !== undefined) await chrome.storage.session.set({ [`tabDraft:${tabId}`]: draft.id });
    return draft;
  }
  if (message.type === 'APPLICATION_SUCCESS_DETECTED' && tabId !== undefined) {
    if (!(await enforceIdentityBoundary())) return undefined;
    const key = `tabDraft:${tabId}`;
    const stored = await chrome.storage.session.get(key);
    const draftId = stored[key];
    if (typeof draftId === 'string') {
      const application = await confirmStoredDraft(draftId, 'detected');
      await chrome.storage.session.remove(key);
      void requestSync();
      return application;
    }
  }
  return undefined;
}

async function requestSync(): Promise<void> {
  if (!syncInFlight) syncInFlight = runSync().finally(() => { syncInFlight = undefined; });
  return syncInFlight;
}

async function runSync(): Promise<void> {
  const state = await readState();
  const connection = state.connection;
  if (!connection?.spreadsheetId || !connection.worksheetTitle) return;

  let identity;
  try {
    identity = await getSilentIdentity(connection.accountId);
  } catch (error) {
    if (error instanceof IdentityBoundaryError) {
      await disconnectGoogleIdentity();
      await clearIdentityBoundary('The Chrome Google account changed or disconnected. Local drafts and queued records were cleared before another account could receive them.');
      await chrome.storage.session.clear();
      return;
    }
    await setSyncSummary(connection.accountId, connection.spreadsheetId, { state: 'error', message: friendlyError(error) });
    return;
  }

  const due = Object.values(state.applications)
    .filter((application) => application.ownerAccountId === connection.accountId)
    .filter((application) => application.sync.state === 'pending'
      || (application.sync.state === 'retrying'
        && (!application.sync.nextAttemptAt || application.sync.nextAttemptAt <= new Date().toISOString())));
  if (!due.length) {
    await summarizeSyncState(connection.accountId, connection.spreadsheetId);
    return;
  }

  await setSyncSummary(connection.accountId, connection.spreadsheetId, { state: 'syncing', message: `Syncing ${due.length} confirmed application${due.length === 1 ? '' : 's'}…` });
  for (const application of due) {
    try {
      const sheetRow = await appendApplicationIdempotently(
        identity.token,
        connection.spreadsheetId,
        connection.worksheetTitle,
        application,
      );
      const syncedAt = new Date().toISOString();
      await updateApplication(application.id, connection.accountId, connection.spreadsheetId, (current) => ({
        ...current,
        sync: { ...current.sync, state: 'synced', sheetRow, nextAttemptAt: undefined, lastError: undefined },
      }));
      await setSyncSummary(connection.accountId, connection.spreadsheetId, { state: 'ready', message: 'All confirmed applications are synced.', lastSyncedAt: syncedAt });
    } catch (error) {
      const apiError = error instanceof SheetsApiError ? error : undefined;
      if (apiError?.status === 401) await removeCachedToken(identity.token);
      const attempts = application.sync.attempts + 1;
      const retryable = apiError ? isRetryableStatus(apiError.status) : false;
      const message = friendlyError(error);
      await updateApplication(application.id, connection.accountId, connection.spreadsheetId, (current) => ({
        ...current,
        sync: {
          ...current.sync,
          state: retryable ? 'retrying' : 'blocked',
          attempts,
          nextAttemptAt: retryable ? new Date(Date.now() + retryDelayMs(attempts)).toISOString() : undefined,
          lastError: message,
        },
      }));
      await setSyncSummary(connection.accountId, connection.spreadsheetId, { state: retryable ? 'retrying' : 'error', message });
      if (retryable) break;
    }
  }
  await summarizeSyncState(connection.accountId, connection.spreadsheetId);
}

async function summarizeSyncState(accountId: string, spreadsheetId: string): Promise<void> {
  const state = await readState();
  if (state.connection?.accountId !== accountId || state.connection.spreadsheetId !== spreadsheetId) return;
  const applications = Object.values(state.applications).filter((application) => application.ownerAccountId === accountId);
  const queued = applications.filter(({ sync }) => sync.state === 'pending' || sync.state === 'retrying');
  const blocked = applications.find(({ sync }) => sync.state === 'blocked');
  if (queued.length) {
    await setSyncSummary(accountId, spreadsheetId, {
      state: 'retrying',
      message: `${queued.length} confirmed application${queued.length === 1 ? ' is' : 's are'} queued. Sync will retry automatically.`,
      lastSyncedAt: state.syncSummary.lastSyncedAt,
    });
  } else if (blocked) {
    await setSyncSummary(accountId, spreadsheetId, {
      state: 'error',
      message: blocked.sync.lastError ?? 'A confirmed application needs attention.',
      lastSyncedAt: state.syncSummary.lastSyncedAt,
    });
  } else {
    await setSyncSummary(accountId, spreadsheetId, {
      state: 'ready',
      message: 'All confirmed applications are synced.',
      lastSyncedAt: state.syncSummary.lastSyncedAt,
    });
  }
}

async function notifySummary(day: 3 | 6, drafts: JobDraft[]): Promise<void> {
  if (!drafts.length) return;
  const title = `${drafts.length} application draft${drafts.length === 1 ? '' : 's'} need attention`;
  const names = drafts.slice(0, 3).map((draft) => `${draft.role}${draft.company ? ` at ${draft.company}` : ''}`);
  await chrome.notifications.create(`draft-day-${day}-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icon128.png',
    title,
    message: `Day ${day}: ${names.join('; ')}${drafts.length > 3 ? ` and ${drafts.length - 3} more` : ''}`,
  });
}

async function runMaintenance(): Promise<void> {
  if (!(await enforceIdentityBoundary())) return;
  const state = await readState();
  const accountId = state.connection?.accountId;
  const currentDrafts = Object.values(state.drafts).filter((draft) => draft.ownerAccountId === accountId);
  const result = evaluateDrafts(currentDrafts);
  await notifySummary(3, result.reminder3);
  await notifySummary(6, result.reminder6);
  const expired = new Set(result.expiredIds);
  const drafts = Object.fromEntries(
    currentDrafts
      .filter((draft) => !expired.has(draft.id))
      .map((draft) => {
        let next = draft;
        if (result.reminder3.some(({ id }) => id === draft.id)) next = markReminded(next, 3);
        if (result.reminder6.some(({ id }) => id === draft.id)) next = markReminded(next, 6);
        return [next.id, next];
      }),
  );
  await replaceDrafts(drafts);
}
