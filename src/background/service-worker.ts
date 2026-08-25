import { evaluateDrafts, markReminded } from '../domain/lifecycle';
import type { CapturedJob, JobDraft } from '../domain/model';
import { confirmStoredDraft, readState, replaceDrafts, upsertDraft } from '../storage/repository';

const MAINTENANCE_ALARM = 'draft-maintenance';

chrome.runtime.onInstalled.addListener(() => {
  void chrome.alarms.create(MAINTENANCE_ALARM, { delayInMinutes: 1, periodInMinutes: 60 });
});

chrome.runtime.onStartup.addListener(() => {
  void runMaintenance();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === MAINTENANCE_ALARM) void runMaintenance();
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  void handleMessage(message, sender.tab?.id).then(sendResponse);
  return true;
});

async function handleMessage(message: unknown, tabId?: number): Promise<unknown> {
  if (!message || typeof message !== 'object' || !('type' in message)) return undefined;
  if (message.type === 'JOB_DETECTED' && 'job' in message) {
    const draft = await upsertDraft(message.job as CapturedJob);
    if (tabId !== undefined) await chrome.storage.session.set({ [`tabDraft:${tabId}`]: draft.id });
    return draft;
  }
  if (message.type === 'APPLICATION_SUCCESS_DETECTED' && tabId !== undefined) {
    const key = `tabDraft:${tabId}`;
    const stored = await chrome.storage.session.get(key);
    const draftId = stored[key];
    if (typeof draftId === 'string') {
      const application = await confirmStoredDraft(draftId, 'detected');
      await chrome.storage.session.remove(key);
      return application;
    }
  }
  return undefined;
}

async function notifySummary(day: 3 | 6, drafts: JobDraft[]): Promise<void> {
  if (!drafts.length) return;
  const title = `${drafts.length} application draft${drafts.length === 1 ? '' : 's'} need attention`;
  const names = drafts.slice(0, 3).map((draft) => `${draft.role}${draft.company ? ` at ${draft.company}` : ''}`);
  await chrome.notifications.create(`draft-day-${day}-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icon.svg',
    title,
    message: `Day ${day}: ${names.join('; ')}${drafts.length > 3 ? ` and ${drafts.length - 3} more` : ''}`,
  });
}

async function runMaintenance(): Promise<void> {
  const state = await readState();
  const result = evaluateDrafts(Object.values(state.drafts));
  await notifySummary(3, result.reminder3);
  await notifySummary(6, result.reminder6);
  const expired = new Set(result.expiredIds);
  const drafts = Object.fromEntries(
    Object.values(state.drafts)
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
