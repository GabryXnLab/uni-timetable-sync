# CLAUDE.md — Uni Timetable Sync

## Cos'è

Progetto Google Apps Script open source (MIT) che legge un orario iCalendar (formato EasyCourse
come Kairos UniFi, oppure qualsiasi `.ics`) e sincronizza le lezioni su Google Calendar tramite
trigger temporali. Pensato per essere riusato da qualsiasi studente: nessun dato personale o di
ateneo nel codice.

## Stack

- TypeScript, bundle con esbuild (server → `Code.gs`) e Vite + React (pannello → `Dashboard.html`).
- pnpm, vitest, clasp per il deploy su Apps Script.

## Struttura

```
src/server/ical.ts    # parsing iCalendar (EasyCourse + generico) → Lesson (puro, testato)
src/server/index.ts   # fetch, sincronizzazione Calendar, trigger, funzioni esposte
src/client/           # pannello React opzionale (Web App)
.github/workflows/    # deploy automatico su push a main
scripts/build.mjs     # build in dist/ + wrapper globali per Apps Script
tests/                # test vitest del parser
dist/                 # output caricato con clasp (ignorato da Git)
```

## Comandi

```bash
pnpm type-check
pnpm test
pnpm build
pnpm push    # build + clasp push sul progetto Apps Script (deploy manuale)
```

`.github/workflows/deploy.yml` esegue type-check e test su push e pull request; su `main`, se la
variabile del repo `SCRIPT_ID` esiste, anche build, `clasp push` e (con `DEPLOYMENT_ID`)
ridistribuzione della Web App. Credenziali clasp nel secret `CLASPRC_JSON`.

## Note architetturali importanti

- Ogni funzione chiamabile da Apps Script (trigger, editor, `google.script.run`) deve essere
  esportata da `src/server/index.ts` **e** aggiunta all'elenco `globals` in `scripts/build.mjs`.
- Repo pubblico: niente ID di script/deployment, URL di corsi, nomi di docenti o aule reali nel
  codice, nei test o nella documentazione. La configurazione è nelle proprietà dello script
  (`ICAL_URL`, `CALENDAR_ID`, `EVENT_COLOR`, `SYNC_HOUR`, `CHECK_HOUR`), gli ID di deploy in `vars` del repo.
- Gli eventi gestiti sono riconosciuti solo dal tag privato `uni_timetable_uid`: la
  sincronizzazione non tocca mai eventi senza quel tag. Cambiarne il nome abbandona gli eventi
  già creati dagli utenti.
- L'UID EasyCourse contiene orario di inizio e aula: se cambia l'aula o l'ora, l'UID cambia e
  l'evento viene rimosso e ricreato, non aggiornato.
- I trigger vanno installati dall'editor Apps Script (`installTriggers`): `clasp run` con le
  credenziali CLI non ha i permessi di esecuzione remota. I trigger temporali non
  garantiscono il minuto esatto.
- Il fuso viene da `appsscript.json` (`Session.getScriptTimeZone()`): il calcolo dei giorni usa
  `new Date(y, m, d)`, quindi gli orari iCal senza `Z` sono letti in quel fuso.

## Convenzioni

- Codice in inglese, testi utente, log, commenti e commit in italiano.
- Commit atomici in stile Conventional Commits (`feat:`, `fix:`, `docs:`…).
