export const SHEET_COLUMNS = [
  'Company',
  'Role',
  'Location',
  'Applied Date',
  'Source',
  'Status',
  'Current Status',
  'Referral',
  'Job URL',
  'JD Snapshot',
  'Notes',
] as const;

export const CURRENT_STATUS_OPTIONS = [
  'Applied',
  'Referral requested',
  'Interview – Round 1',
  'Interview – Round 2',
  'Interview – Round 3',
  'Interview – Final Round',
  'Rejected',
  'Offer',
  'Withdrawn',
] as const;

export type JobSource = 'LinkedIn' | 'Handshake' | 'Workday' | 'Greenhouse' | '12twenty';

export interface CapturedJob {
  company: string;
  role: string;
  location: string;
  jobUrl: string;
  source: JobSource;
  jdSnapshot: string;
}

export interface ReminderState {
  day3SentAt?: string;
  day6SentAt?: string;
}

export interface JobDraft extends CapturedJob {
  id: string;
  ownerAccountId: string;
  fingerprint: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  reminderState: ReminderState;
}

export interface ConfirmedApplication extends CapturedJob {
  id: string;
  ownerAccountId: string;
  draftId: string;
  fingerprint: string;
  appliedDate: string;
  status: 'Applied' | 'Referral requested';
  currentStatus: typeof CURRENT_STATUS_OPTIONS[number];
  referral: boolean;
  notes: string;
  confirmation: 'detected' | 'manual';
  sync: {
    state: 'pending' | 'retrying' | 'synced' | 'blocked';
    attempts: number;
    nextAttemptAt?: string;
    sheetRow?: number;
    lastError?: string;
  };
}

export interface GoogleConnection {
  accountId: string;
  email: string;
  connectedAt: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  worksheetTitle?: string;
  worksheetId?: number;
}

export interface SyncSummary {
  state: 'disconnected' | 'needs_sheet' | 'ready' | 'syncing' | 'retrying' | 'error';
  message?: string;
  lastSyncedAt?: string;
}

export interface TrackerState {
  connection?: GoogleConnection;
  drafts: Record<string, JobDraft>;
  applications: Record<string, ConfirmedApplication>;
  syncSummary: SyncSummary;
}

export const EMPTY_STATE: TrackerState = {
  drafts: {},
  applications: {},
  syncSummary: { state: 'disconnected' },
};
