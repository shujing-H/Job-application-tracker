import { describe, expect, it } from 'vitest';
import { isRetryableStatus, retryDelayMs } from './retry';

describe('Sheets retry policy', () => {
  it('backs off from one minute to six hours', () => {
    expect([1, 2, 3, 4, 5, 20].map((attempt) => retryDelayMs(attempt) / 60_000))
      .toEqual([1, 5, 15, 60, 360, 360]);
  });

  it('retries offline, throttling, timeouts, and server errors only', () => {
    expect([0, 401, 408, 429, 500, 503].every(isRetryableStatus)).toBe(true);
    expect([400, 403, 404].some(isRetryableStatus)).toBe(false);
  });
});
