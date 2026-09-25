# CLAUDE.md — UniFi Meccanica Calendar

## Cos'è

Progetto Google Apps Script che legge l'esportazione iCalendar pubblica di Kairos (orario
1° anno Ingegneria Meccanica UniFi, curriculum A–D) e sincronizza le lezioni su Google
Calendar tramite trigger temporali. Uso personale.

## Stack

- TypeScript, bundle con esbuild (server → `Code.gs`) e Vite + React (pannello → `Dashboard.html`).
- pnpm, vitest, clasp per il deploy su Apps Script.

## Struttura

```
src/server/ical.ts    # parsing iCalendar Kairos → Lesson (puro, testato)
src/server/index.ts   # fetch, sincronizzazione Calendar, trigger, funzioni esposte
src/client/           # pannello React opzionale (Web App)
scripts/build.mjs     # build in dist/ + wrapper globali per Apps Script
tests/                # test vitest del parser
dist/                 # output caricato con clasp (ignorato da Git)
```

## Comandi

```bash
pnpm type-check
pnpm test
pnpm build
pnpm push    # build + clasp push sul progetto Apps Script
```

## Note architetturali importanti

- Ogni funzione chiamabile da Apps Script (trigger, editor, `google.script.run`) deve essere
  esportata da `src/server/index.ts` **e** aggiunta all'elenco `globals` in `scripts/build.mjs`.
- Gli eventi gestiti sono riconosciuti solo dal tag privato `unifi_meccanica_uid`: la
  sincronizzazione non tocca mai eventi senza quel tag.
- L'UID Kairos contiene orario di inizio e aula: se cambia l'aula o l'ora, l'UID cambia e
  l'evento viene rimosso e ricreato, non aggiornato.
- I trigger vanno installati dall'editor Apps Script (`installTriggers`): `clasp run` con le
  credenziali CLI non ha i permessi di esecuzione remota. I trigger temporali non
  garantiscono il minuto esatto.
- Il fuso `Europe/Rome` in `appsscript.json` è necessario: il calcolo dei giorni usa `new Date(y, m, d)`.

## Convenzioni

- Codice in inglese, testi utente, log, commenti e commit in italiano.
- Commit atomici in stile Conventional Commits (`feat:`, `fix:`, `docs:`…).
