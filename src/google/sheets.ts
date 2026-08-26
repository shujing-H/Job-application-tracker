import { canonicalizeJobUrl, jobFingerprint } from '../domain/lifecycle';
import { SHEET_COLUMNS, type ConfirmedApplication } from '../domain/model';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';
export const DEFAULT_WORKSHEET = 'Applications';
const APPLICATION_METADATA_KEY = 'jobTrackerApplicationId';

export class SheetsApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function request<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
  } catch {
    throw new SheetsApiError(0, 'You appear to be offline. Sync will retry automatically.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined;
    throw new SheetsApiError(response.status, body?.error?.message ?? `Google Sheets returned ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

function cell(value: string, bold = false): object {
  return {
    userEnteredValue: { stringValue: value },
    ...(bold ? { userEnteredFormat: { textFormat: { bold: true } } } : {}),
  };
}

export async function createJobTrackerSheet(token: string): Promise<{
  spreadsheetId: string;
  spreadsheetUrl: string;
  worksheetTitle: string;
  worksheetId: number;
}> {
  const result = await request<{
    spreadsheetId: string;
    spreadsheetUrl?: string;
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  }>(token, `${API}?fields=spreadsheetId,spreadsheetUrl,sheets.properties(sheetId,title)`, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title: 'Job Tracker' },
      sheets: [{
        properties: { title: DEFAULT_WORKSHEET, gridProperties: { frozenRowCount: 1 } },
        data: [{ rowData: [{ values: SHEET_COLUMNS.map((column) => cell(column, true)) }] }],
      }],
    }),
  });
  const worksheetId = result.sheets?.find(({ properties }) => properties?.title === DEFAULT_WORKSHEET)?.properties?.sheetId;
  if (worksheetId === undefined) throw new SheetsApiError(500, 'Google created the spreadsheet without the Applications worksheet.');
  return {
    spreadsheetId: result.spreadsheetId,
    spreadsheetUrl: result.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${result.spreadsheetId}/edit`,
    worksheetTitle: DEFAULT_WORKSHEET,
    worksheetId,
  };
}

export function parseSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const id = match?.[1] ?? (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed) ? trimmed : '');
  if (!id) throw new Error('Paste a valid Google Sheets URL or spreadsheet ID.');
  return id;
}

function quoteSheetTitle(title: string): string {
  return `'${title.replaceAll("'", "''")}'`;
}

function columnsMatch(values: unknown[] | undefined): boolean {
  return SHEET_COLUMNS.every((column, index) => values?.[index] === column) && values?.length === SHEET_COLUMNS.length;
}

export async function validateCompatibleSheet(token: string, input: string): Promise<{
  spreadsheetId: string;
  spreadsheetUrl: string;
  worksheetTitle: string;
  worksheetId: number;
}> {
  const spreadsheetId = parseSpreadsheetId(input);
  const metadata = await request<{
    spreadsheetUrl?: string;
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  }>(token, `${API}/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetUrl,sheets.properties(sheetId,title)`);
  for (const sheet of metadata.sheets ?? []) {
    const title = sheet.properties?.title;
    const worksheetId = sheet.properties?.sheetId;
    if (!title || worksheetId === undefined) continue;
    const header = await request<{ values?: unknown[][] }>(
      token,
      `${API}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`${quoteSheetTitle(title)}!A1:I1`)}`,
    );
    if (columnsMatch(header.values?.[0])) {
      return {
        spreadsheetId,
        spreadsheetUrl: metadata.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        worksheetTitle: title,
        worksheetId,
      };
    }
  }
  throw new Error(`No worksheet has the exact required columns: ${SHEET_COLUMNS.join(', ')}.`);
}

export function applicationRow(application: ConfirmedApplication): string[] {
  return [
    application.company,
    application.role,
    application.location,
    application.appliedDate,
    application.source,
    application.status,
    application.jobUrl,
    application.jdSnapshot,
    application.notes,
  ];
}

export function findDuplicateRow(rows: unknown[][], application: ConfirmedApplication): number | undefined {
  if (!columnsMatch(rows[0])) throw new Error('The connected sheet columns changed. Reconnect a compatible sheet.');
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (typeof row?.[0] !== 'string' || typeof row?.[1] !== 'string' || typeof row?.[6] !== 'string') continue;
    try {
      const fingerprint = jobFingerprint({ company: row[0], role: row[1], jobUrl: canonicalizeJobUrl(row[6]) });
      if (fingerprint === application.fingerprint) return index + 1;
    } catch {
      // A malformed hand-edited row is not a match.
    }
  }
  return undefined;
}

export async function appendApplicationIdempotently(
  token: string,
  spreadsheetId: string,
  worksheetTitle: string,
  worksheetId: number,
  application: ConfirmedApplication,
): Promise<number | undefined> {
  const range = `${quoteSheetTitle(worksheetTitle)}!A:I`;
  const current = await request<{ values?: unknown[][] }>(
    token,
    `${API}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
  );
  const duplicate = findDuplicateRow(current.values ?? [], application);
  if (duplicate) return duplicate;

  const metadata = await request<{ matchedDeveloperMetadata?: unknown[] }>(
    token,
    `${API}/${encodeURIComponent(spreadsheetId)}/developerMetadata:search`,
    {
      method: 'POST',
      body: JSON.stringify({
        dataFilters: [{ developerMetadataLookup: {
          metadataKey: APPLICATION_METADATA_KEY,
          metadataValue: application.id,
          visibility: 'PROJECT',
        } }],
      }),
    },
  );
  if (metadata.matchedDeveloperMetadata?.length) return undefined;

  await request(
    token,
    `${API}/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            appendCells: {
              sheetId: worksheetId,
              rows: [{ values: applicationRow(application).map((value) => cell(value)) }],
              fields: 'userEnteredValue',
            },
          },
          {
            createDeveloperMetadata: {
              developerMetadata: {
                metadataKey: APPLICATION_METADATA_KEY,
                metadataValue: application.id,
                visibility: 'PROJECT',
                location: { sheetId: worksheetId },
              },
            },
          },
        ],
      }),
    },
  );
  return undefined;
}
