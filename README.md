# Orario Meccanica UniFi → Google Calendar

Progetto Apps Script autonomo: [apri nell'editor Google](https://script.google.com/d/1lo63w_xdPURk9EHelDdd5UJdOsCvI9XPxwB3P1lV8et4z1DHqHSFnnAV/edit). Ogni domenica verso le 18:00 (fuso `Europe/Rome`) legge l'esportazione iCalendar pubblica di Kairos per **1° anno, Meccanico Formativo A–D (2026)** e sincronizza le lezioni della settimana da lunedì a domenica successiva.

## Verifica della fonte

Il 16 settembre 2026 l'URL fornito ha risposto HTTP 200 senza autenticazione. Il sito espone `export/ec_download_ical_list.php`, che ha restituito `text/calendar; charset=utf-8` con 276 eventi, di cui 254 lezioni riconosciute. La settimana 21–27 settembre 2026 contiene 9 lezioni. L'esportazione comprende più settimane: il codice seleziona solo la settimana interessata. Non è stato rilevato CAPTCHA o login in questa prova. Un fetch effettivo dall'infrastruttura Apps Script richiede una prima esecuzione autorizzata sul progetto Google; `clasp run` con le credenziali CLI correnti segnala permessi insufficienti per l'esecuzione remota.

Le righe iCalendar includono materia, docenti e aula nel campo `SUMMARY`; i giorni festivi sono esclusi. Kairos non fornisce campi `LOCATION` o `DESCRIPTION` per queste lezioni: l'automazione ricava aula e altri dettagli dal riepilogo. Il titolo nel calendario contiene solo la materia; la dicitura “(Cognomi A-D)” resta nella descrizione originale.

Nessuna materia è configurata nel codice: ogni esecuzione usa le lezioni presenti nell'esportazione in quel momento. L'URL fissa solo il corso di studio, il curriculum, l'anno accademico e la data della settimana. Se una materia compare o scompare, la sincronizzazione crea o rimuove i relativi eventi della settimana interessata.

## Struttura

- `src/server/` — parsing iCalendar, fetch, sincronizzazione e trigger Apps Script.
- `src/client/` — pannello React per anteprima, sincronizzazione manuale e attivazione trigger.
- `scripts/build.mjs` — esbuild per `Code.gs`, Vite per `Dashboard.html`.
- `dist/` — soli file caricati con clasp.

## Uso

```bash
pnpm install
pnpm type-check
pnpm test
pnpm build
pnpm push
```

Lo sviluppo richiede Node.js 20+ e pnpm. Non serve alcun server locale durante l'esecuzione programmata.

Il progetto Apps Script è già stato creato. In un nuovo checkout, collegarlo con `clasp clone 1lo63w_xdPURk9EHelDdd5UJdOsCvI9XPxwB3P1lV8et4z1DHqHSFnnAV --rootDir dist`, poi ricostruire con `pnpm build`. L'identificativo locale è in `.clasp.json` (ignorato da Git). Dopo il push, eseguire **una volta** `previewNextWeek` nell'editor Apps Script e autorizzare gli scope richiesti. Poi eseguire `installTriggers`; si può eseguire `syncNextWeek` per popolare subito la settimana seguente. Il trigger settimanale verrà eseguito la domenica tra le 18:00 e le 19:00; Apps Script non garantisce il minuto esatto.

Dal lunedì al sabato, verso le 7:00 (±15 minuti), `checkThisWeek` riconfronta con Kairos le lezioni da oggi a domenica e corregge nel calendario materia, orario e aula. Kairos cambia UID quando cambiano aula o orario, quindi una variazione compare nei log come coppia “rimossa” + “nuova” con i relativi dettagli.

Tutti gli eventi creati dall'automazione hanno il colore “Mirtillo”. Nel calendario web si può dare a quel colore l'etichetta “Università” (menu colore di un evento → modifica etichetta): vale per tutte le lezioni. Gli eventi già esistenti vengono ricolorati alla successiva sincronizzazione o al controllo giornaliero successivo. Per usare un calendario diverso da quello principale, impostare la proprietà script `CALENDAR_ID` con l'ID del calendario desiderato.

Per controllare l'esito, eseguire `verifySetup`: registra nei log la settimana, il calendario, i conteggi Kairos/Calendar, il numero di trigger ed eventuali lezioni mancanti, da aggiornare o extra. `success: true` indica che la settimana successiva coincide con Kairos e che esiste esattamente un trigger per `syncNextWeek` e uno per `checkThisWeek`. Dopo una modifica del formato dei titoli, eseguire nuovamente `syncNextWeek`: aggiorna anche gli eventi già presenti con lo stesso UID. Le funzioni di anteprima, installazione e sincronizzazione registrano ora un riepilogo nei log.

Il pannello React è opzionale: per aprirlo occorre creare una distribuzione **Web App** dall'editor Apps Script. Le funzioni e il trigger funzionano anche senza Web App.

La funzione di sincronizzazione crea o aggiorna gli eventi usando un tag privato con l'UID Kairos. Rimuove dalla settimana interessata solo gli eventi che portano quel tag; gli altri eventi nel calendario non vengono toccati. La ripetizione è idempotente. Se il fetch o il formato iCalendar falliscono, la sincronizzazione si interrompe senza eliminare eventi.

## Manutenzione

L'URL del corso e l'anno accademico sono nella costante `SOURCE` in `src/server/index.ts`. Va aggiornato all'anno successivo o se cambia il curriculum. Il formato iCalendar è controllato con test e deve essere riverificato se Kairos cambia esportazione. L'intero flusso di produzione gira su Apps Script; Node, Vite e React servono solo durante lo sviluppo e per il pannello HTML ospitato dallo stesso progetto Apps Script.
