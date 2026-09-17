import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

type Lesson = { uid: string; title: string; start: string; end: string; location: string; description: string };
type Preview = { week: string; count: number; lessons: Lesson[] };
type Sync = { week: string; fetched: number; created: number; updated: number; deleted: number };
type Verification = { success: boolean; sourceLessons: number; calendarLessons: number; triggerCount: number; missing: string[]; outdated: string[]; extra: string[] };

interface GasRunner {
  withSuccessHandler(callback: (value: unknown) => void): GasRunner;
  withFailureHandler(callback: (error: Error) => void): GasRunner;
  previewNextWeek(): void;
  syncNextWeek(): void;
  installWeeklyTrigger(): void;
  verifySetup(): void;
}

declare global {
  interface Window {
    google?: { script: { run: GasRunner } };
  }
}

function App() {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState('');

  function call<T>(method: 'previewNextWeek' | 'syncNextWeek' | 'installWeeklyTrigger' | 'verifySetup', done: (value: T) => void) {
    setBusy(true);
    setMessage('');
    const run = window.google?.script.run;
    if (!run) { setMessage('Apri questa pagina dalla web app Apps Script.'); setBusy(false); return; }
    run.withSuccessHandler(value => { setBusy(false); done(value as T); })
      .withFailureHandler(error => { setBusy(false); setMessage(error.message); })[method]();
  }

  return <main>
    <header><span>UNIFI · INGEGNERIA</span><h1>Orario Meccanica</h1><p>Primo anno · curriculum formativo A–D</p></header>
    <section className="panel"><h2>Settimana prossima</h2><p>Gli orari sono letti da Kairos al momento della sincronizzazione.</p>
      <div className="actions">
        <button disabled={busy} onClick={() => call<Preview>('previewNextWeek', setPreview)}>Anteprima</button>
        <button disabled={busy} onClick={() => call<Sync>('syncNextWeek', result => setMessage(`Settimana ${result.week}: ${result.fetched} lezioni, ${result.created} create, ${result.updated} aggiornate, ${result.deleted} rimosse.`))}>Sincronizza ora</button>
        <button disabled={busy} onClick={() => call<{ installed: boolean }>('installWeeklyTrigger', () => setMessage('Trigger domenicale installato alle 18:00 (Europe/Rome).'))}>Attiva domenica</button>
        <button disabled={busy} onClick={() => call<Verification>('verifySetup', result => setMessage(result.success ? `Verifica riuscita: ${result.calendarLessons} lezioni nel calendario e ${result.triggerCount} trigger.` : `Verifica incompleta: ${result.sourceLessons} lezioni Kairos, ${result.calendarLessons} nel calendario, ${result.triggerCount} trigger. Mancanti: ${result.missing.join(', ') || 'nessuna'}; da aggiornare: ${result.outdated.join(', ') || 'nessuna'}; extra: ${result.extra.join(', ') || 'nessuna'}.`))}>Verifica</button>
      </div>
      {busy && <p role="status">Operazione in corso…</p>}
      {message && <p role="status" className="notice">{message}</p>}
    </section>
    {preview && <section className="panel"><h2>{preview.week} · {preview.count} lezioni</h2>
      {preview.lessons.length ? <ul>{preview.lessons.map(lesson => <li key={lesson.uid}><strong>{lesson.title}</strong><span>{lesson.start}–{lesson.end}</span><small>{lesson.location}</small></li>)}</ul> : <p>Nessuna lezione prevista.</p>}
    </section>}
    <footer>Fonte: <a href="https://kairos.unifi.it/agendaweb/" target="_blank" rel="noreferrer">Kairos UniFi</a></footer>
  </main>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
