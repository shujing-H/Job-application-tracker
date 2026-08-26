export function retryDelayMs(attempts: number): number {
  const scheduleMinutes = [1, 5, 15, 60, 360];
  return scheduleMinutes[Math.min(Math.max(attempts - 1, 0), scheduleMinutes.length - 1)] * 60_000;
}

export function isRetryableStatus(status: number): boolean {
  return status === 0 || status === 401 || status === 408 || status === 429 || status >= 500;
}
