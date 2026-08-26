import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { JobDraft, TrackerState } from '../domain/model';
import './styles.css';

type ExtensionResponse<T> = { ok: true; result: T } | { ok: false; error: string };

async function send<T>(message: object): Promise<T> {
  const response = await chrome.runtime.sendMessage(message) as ExtensionResponse<T>;
  if (!response.ok) throw new Error(response.error);
  return response.result;
}

function App(): React.JSX.Element {
  const [state, setState] = useState<TrackerState>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sheetInput, setSheetInput] = useState('');

  const refresh = () => void send<TrackerState>({ type: 'GET_STATE' }).then(setState);
  useEffect(() => {
    refresh();
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes.trackerStateV2) refresh();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  async function act(operation: () => Promise<TrackerState | unknown>): Promise<void> {
    setBusy(true);
    setError('');
    try {
      const result = await operation();
      if (result && typeof result === 'object' && 'drafts' in result) setState(result as TrackerState);
      else refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (!state) return <main><p>Loading…</p></main>;
  const accountId = state.connection?.accountId;
  const drafts = Object.values(state.drafts)
    .filter((draft) => draft.ownerAccountId === accountId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const applications = Object.values(state.applications).filter((application) => application.ownerAccountId === accountId);
  const queued = applications.filter(({ sync }) => sync.state === 'pending' || sync.state === 'retrying').length;
  const blocked = applications.filter(({ sync }) => sync.state === 'blocked').length;

  return (
    <main>
      <header>
        <div className="brand"><img src="/icon.svg" alt="" /><div><p className="eyebrow">PRIVATE JOB TRACKER</p><h1>Applications</h1></div></div>
        <span className="count">{drafts.length}</span>
      </header>

      {!state.connection && (
        <section className="setup">
          <h2>Connect your Google account</h2>
          <p>Drafts stay on this device. Only applications you confirm are written to your own sheet.</p>
          <button className="primary wide" disabled={busy} onClick={() => act(() => send({ type: 'CONNECT_GOOGLE' }))}>
            Sign in with Google
          </button>
        </section>
      )}

      {state.connection && !state.connection.spreadsheetId && (
        <section className="setup">
          <div className="account-row"><span>Signed in as <strong>{state.connection.email}</strong></span></div>
          <h2>Choose your Job Tracker sheet</h2>
          <button className="primary wide" disabled={busy} onClick={() => act(() => send({ type: 'CREATE_SHEET' }))}>
            Create “Job Tracker” sheet
          </button>
          <div className="divider"><span>or connect one created by this extension</span></div>
          <label htmlFor="sheet-url">Google Sheets URL</label>
          <input id="sheet-url" value={sheetInput} onChange={(event) => setSheetInput(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" />
          <button className="wide" disabled={busy || !sheetInput.trim()} onClick={() => act(() => send({ type: 'CONNECT_SHEET', input: sheetInput }))}>
            Check and connect sheet
          </button>
          <button className="link danger" disabled={busy} onClick={() => act(() => send({ type: 'DISCONNECT_GOOGLE' }))}>Disconnect and clear local data</button>
        </section>
      )}

      {state.connection?.spreadsheetId && (
        <>
          <section className={`sync ${state.syncSummary.state}`}>
            <div>
              <p className="eyebrow">GOOGLE SHEETS</p>
              <h2>{state.syncSummary.state === 'syncing' ? 'Syncing…' : queued ? `${queued} queued` : blocked ? `${blocked} needs attention` : 'Up to date'}</h2>
              <p>{state.syncSummary.message ?? `Connected as ${state.connection.email}`}</p>
            </div>
            <div className="sync-actions">
              <a href={state.connection.spreadsheetUrl} target="_blank" rel="noreferrer">Open sheet</a>
              <button disabled={busy} onClick={() => act(() => send({ type: 'SYNC_NOW' }))}>Sync now</button>
              {(state.syncSummary.state === 'error' || state.syncSummary.state === 'retrying')
                && <button disabled={busy} onClick={() => act(() => send({ type: 'CONNECT_GOOGLE' }))}>Reconnect Google</button>}
            </div>
          </section>

          {drafts.length === 0 && <section className="empty"><h2>No drafts yet</h2><p>Open a supported job page and its details will stay on this device.</p></section>}
          {drafts.map((draft) => <DraftCard key={draft.id} draft={draft} busy={busy} act={act} />)}

          <section className="account-footer">
            <span>{state.connection.email}</span>
            <button className="link" disabled={busy} onClick={() => act(() => send({ type: 'CHANGE_SHEET' }))}>Change sheet</button>
            <button className="link danger" disabled={busy} onClick={() => act(() => send({ type: 'DISCONNECT_GOOGLE' }))}>Disconnect & clear</button>
          </section>
        </>
      )}

      {error && <p className="error" role="alert">{error}</p>}
      <footer>Nothing is filled or submitted for you. Disconnecting clears all local drafts and queued records.</footer>
    </main>
  );
}

function DraftCard({ draft, busy, act }: {
  draft: JobDraft;
  busy: boolean;
  act: (operation: () => Promise<unknown>) => Promise<void>;
}): React.JSX.Element {
  const daysLeft = Math.max(0, Math.ceil((new Date(draft.expiresAt).getTime() - Date.now()) / 86_400_000));
  return (
    <article>
      <p className="source">{draft.source}</p>
      <h2>{draft.role}</h2>
      <p>{draft.company || 'Company not detected'}{draft.location ? ` · ${draft.location}` : ''}</p>
      <p className="expiry">Expires in {daysLeft} day{daysLeft === 1 ? '' : 's'}</p>
      <div className="actions">
        <button className="primary" disabled={busy} onClick={() => act(() => send({ type: 'CONFIRM_DRAFT', id: draft.id }))}>I applied</button>
        <button disabled={busy} onClick={() => act(() => send({ type: 'REQUEST_REFERRAL', id: draft.id }))}>Request referral</button>
        <button disabled={busy} onClick={() => act(() => send({ type: 'EXTEND_DRAFT', id: draft.id }))}>Extend 7 days</button>
        <button className="danger" disabled={busy} onClick={() => act(() => send({ type: 'DELETE_DRAFT', id: draft.id }))}>Delete</button>
      </div>
    </article>
  );
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
