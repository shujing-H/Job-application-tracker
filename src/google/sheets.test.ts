import { afterEach, describe, expect, it, vi } from 'vitest';
import { jobFingerprint } from '../domain/lifecycle';
import { SHEET_COLUMNS, type ConfirmedApplication } from '../domain/model';
import { appendApplicationIdempotently, applicationRow, findDuplicateRow, parseSpreadsheetId } from './sheets';

const application: ConfirmedApplication = {
  id: 'application-1',
  ownerAccountId: 'account-1',
  draftId: 'draft-1',
  fingerprint: jobFingerprint({ company: 'Acme', role: 'Engineer', jobUrl: 'https://example.com/jobs/1' }),
  company: 'Acme',
  role: 'Engineer',
  location: 'New York',
  appliedDate: '2026-08-26T12:00:00.000Z',
  source: 'LinkedIn',
  status: 'Applied',
  jobUrl: 'https://example.com/jobs/1',
  jdSnapshot: 'Description',
  notes: '',
  confirmation: 'manual',
  sync: { state: 'pending', attempts: 0 },
};

describe('Google Sheets mapping', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('maps the confirmed record to the nine exact columns', () => {
    expect(applicationRow(application)).toEqual([
      'Acme', 'Engineer', 'New York', '2026-08-26T12:00:00.000Z', 'LinkedIn',
      'Applied', 'https://example.com/jobs/1', 'Description', '',
    ]);
    expect(applicationRow(application)).toHaveLength(SHEET_COLUMNS.length);
  });

  it('recognizes a previously appended job despite URL tracking parameters', () => {
    const rows = [
      [...SHEET_COLUMNS],
      ['Acme', 'Engineer', '', '', '', '', 'https://example.com/jobs/1?utm_source=email'],
    ];
    expect(findDuplicateRow(rows, application)).toBe(2);
  });

  it('rejects changed headers before reading or appending', () => {
    const rows = [[...SHEET_COLUMNS.slice(0, 8), 'Private ID']];
    expect(() => findDuplicateRow(rows, application)).toThrow('columns changed');
  });

  it('parses sheet links without accepting arbitrary text', () => {
    expect(parseSpreadsheetId('https://docs.google.com/spreadsheets/d/abcDEF_12345678901234567890/edit'))
      .toBe('abcDEF_12345678901234567890');
    expect(() => parseSpreadsheetId('not a sheet')).toThrow('valid Google Sheets URL');
  });

  it('does not append when the fingerprint already exists remotely', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      values: [[...SHEET_COLUMNS], ['Acme', 'Engineer', '', '', '', '', 'https://example.com/jobs/1']],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await appendApplicationIdempotently('token', 'sheet-id', 'Applications', application)).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBeUndefined();
  });

  it('reads for duplicates before appending a new confirmed row', async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => Promise.reject(new Error('unmocked call')))
      .mockResolvedValueOnce(new Response(JSON.stringify({ values: [[...SHEET_COLUMNS]] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ updates: { updatedRange: 'Applications!A2:I2' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await appendApplicationIdempotently('token', 'sheet-id', 'Applications', application)).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('POST');
    expect(fetchMock.mock.calls[1]?.[1]?.body).toContain('https://example.com/jobs/1');
  });
});
