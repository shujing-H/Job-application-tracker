import { extractJob, hasHighConfidenceSuccessMessage } from '../extractors';

let lastPayload = '';
let lastSuccessUrl = '';
let scanTimer: number | undefined;

async function scan(): Promise<void> {
  const job = extractJob();
  if (job) {
    const payload = JSON.stringify(job);
    if (payload !== lastPayload) {
      lastPayload = payload;
      await chrome.runtime.sendMessage({ type: 'JOB_DETECTED', job });
    }
  }
  if (hasHighConfidenceSuccessMessage() && lastSuccessUrl !== location.href) {
    lastSuccessUrl = location.href;
    await chrome.runtime.sendMessage({ type: 'APPLICATION_SUCCESS_DETECTED', jobUrl: location.href });
  }
}

void scan();
const observer = new MutationObserver(() => {
  window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(() => void scan(), 400);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
