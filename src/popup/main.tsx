import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { JobDraft, TrackerState } from '../domain/model';
import { confirmStoredDraft, deleteDraft, extendStoredDraft, readState } from '../storage/repository';
import './styles.css';

function App(): React.JSX.Element {
  const [state, setState] = useState<TrackerState>();
  const refresh = () => void readState().then(setState);
  useEffect(refresh, []);

  async function act(operation: () => Promise<unknown>): Promise<void> {
    await operation();
    refresh();
  }

  const drafts = state ? Object.values(state.drafts).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : [];
  const pendingCount = state ? Object.values(state.applications).filter(({ sync }) => sync.state !== 'synced').length : 0;
  return (
    <main>
      <header><div><p className="eyebrow">LOCAL DRAFTS</p><h1>Applications</h1></div><span className="count">{drafts.length}</span></header>
      {pendingCount > 0 && <p className="notice">{pendingCount} confirmed application{pendingCount === 1 ? '' : 's'} safely queued for the future Google Sheets sync.</p>}
      {!state && <p>Loading…</p>}
      {state && drafts.length === 0 && <section className="empty"><h2>No drafts yet</h2><p>Open a supported job page and its details will stay on this device.</p></section>}
      {drafts.map((draft) => <DraftCard key={draft.id} draft={draft} act={act} />)}
      <footer>Nothing is filled or submitted for you.</footer>
    </main>
  );
}

function DraftCard({ draft, act }: { draft: JobDraft; act: (operation: () => Promise<unknown>) => Promise<void> }): React.JSX.Element {
  const daysLeft = Math.max(0, Math.ceil((new Date(draft.expiresAt).getTime() - Date.now()) / 86_400_000));
  return (
    <article>
      <p className="source">{draft.source}</p>
      <h2>{draft.role}</h2>
      <p>{draft.company || 'Company not detected'}{draft.location ? ` · ${draft.location}` : ''}</p>
      <p className="expiry">Expires in {daysLeft} day{daysLeft === 1 ? '' : 's'}</p>
      <div className="actions">
        <button className="primary" onClick={() => act(() => confirmStoredDraft(draft.id, 'manual'))}>I applied</button>
        <button onClick={() => act(() => extendStoredDraft(draft.id))}>Extend 7 days</button>
        <button className="danger" onClick={() => act(() => deleteDraft(draft.id))}>Delete</button>
      </div>
    </article>
  );
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
