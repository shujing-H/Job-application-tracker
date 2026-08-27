import { extractJob, hasHighConfidenceSuccessMessage } from '../extractors';

let lastPayload = '';
let lastSuccessUrl = '';
let scanTimer: number | undefined;
let contextActive = true;
let observer: MutationObserver | undefined;

async function sendToBackground(message: object): Promise<boolean> {
  // A content script can outlive an extension reload on an already-open job
  // page. Stop quietly instead of leaving an unhandled rejected promise in
  // chrome://extensions when that old execution context disappears.
  if (!chrome.runtime?.id || !contextActive) return false;
  try {
    await chrome.runtime.sendMessage(message);
    return true;
  } catch (error) {
    if (error instanceof Error && /Extension context invalidated/i.test(error.message)) {
      contextActive = false;
      observer?.disconnect();
      window.clearTimeout(scanTimer);
      return false;
    }
    throw error;
  }
}

async function scan(): Promise<void> {
  if (!contextActive) return;
  const job = extractJob();
  if (job) {
    const payload = JSON.stringify(job);
    if (payload !== lastPayload) {
      lastPayload = payload;
      if (!await sendToBackground({ type: 'JOB_DETECTED', job })) return;
    }
  }
  if (hasHighConfidenceSuccessMessage() && lastSuccessUrl !== location.href) {
    lastSuccessUrl = location.href;
    await sendToBackground({ type: 'APPLICATION_SUCCESS_DETECTED', jobUrl: location.href });
  }
}

void scan().catch(() => undefined);
observer = new MutationObserver(() => {
  if (!contextActive) return;
  window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(() => void scan().catch(() => undefined), 400);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
