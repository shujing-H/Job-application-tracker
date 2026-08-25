export const SHEET_COLUMNS = [
  'Company',
  'Role',
  'Location',
  'Applied Date',
  'Source',
  'Status',
  'Job URL',
  'JD Snapshot',
  'Notes',
] as const;

export type JobSource = 'LinkedIn' | 'Handshake' | 'Workday' | 'Greenhouse';

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
  fingerprint: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  reminderState: ReminderState;
}

export interface ConfirmedApplication extends CapturedJob {
  id: string;
  draftId: string;
  fingerprint: string;
  appliedDate: string;
  status: 'Applied';
  notes: string;
  confirmation: 'detected' | 'manual';
  sync: {
    state: 'pending' | 'retrying' | 'synced';
    attempts: number;
    nextAttemptAt?: string;
    sheetRow?: number;
    lastError?: string;
  };
}

export interface TrackerState {
  drafts: Record<string, JobDraft>;
  applications: Record<string, ConfirmedApplication>;
}

export const EMPTY_STATE: TrackerState = { drafts: {}, applications: {} };
