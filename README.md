# Orario universitario → Google Calendar

Script Google Apps Script che legge l'orario delle lezioni da un link iCalendar (`.ics`) e lo tiene sincronizzato su Google Calendar. Ogni domenica sera carica le lezioni della settimana seguente; dal lunedì al sabato, la mattina, ricontrolla i giorni che mancano e applica cambi di aula, di orario e lezioni annullate.

Funziona con:

- **EasyCourse / EasyAcademy** (per esempio Kairos di UniFi e gli altri atenei che usano l'agenda web EasyCourse). Dal riepilogo dell'evento ricava materia, codice, docente, aula e tipo di attività. Nel titolo resta solo la materia; la partizione per cognome (es. "(Cognomi A-D)") finisce nella descrizione.
- **Qualsiasi altro calendario iCalendar**, usando direttamente titolo, luogo e descrizione dell'evento.

Gira tutto su Apps Script, nel tuo account Google: non serve un server.

## Di cosa hai bisogno

- Un account Google.
- Node.js 20+ e pnpm (`corepack enable`).
- Il link iCalendar del tuo orario. Su EasyCourse/Kairos: apri l'orario delle lezioni, scegli corso, anno e curriculum e usa l'esportazione iCal. Copia il link del file, che contiene `ec_download_ical_list.php`. Il parametro `date=` del link viene aggiornato in automatico per ogni settimana.

## Installazione

1. Abilita l'API Apps Script su <https://script.google.com/home/usersettings>.
2. Clona il repo e installa le dipendenze:

   ```bash
   pnpm install
   pnpm dlx @google/clasp@3.3.0 login
   pnpm dlx @google/clasp@3.3.0 create-script --type standalone --title "Orario universitario" --rootDir dist
   pnpm build && pnpm dlx @google/clasp@3.3.0 push --force
   ```

   `create-script` crea il progetto nel tuo account e salva il suo ID in `.clasp.json`, che Git ignora.
3. Apri il progetto (`pnpm dlx @google/clasp@3.3.0 open-script`). In **Impostazioni progetto → Proprietà dello script** aggiungi almeno `ICAL_URL` (vedi [Configurazione](#configurazione)).
4. Nell'editor esegui **una volta** `previewNextWeek` e autorizza gli accessi richiesti. Nei log trovi le lezioni della settimana prossima.
5. Esegui `installTriggers` per attivare la sincronizzazione automatica. Se vuoi popolare subito il calendario, esegui anche `syncNextWeek`.
6. Esegui `verifySetup`: `success: true` vuol dire che il calendario coincide con la fonte e che i trigger sono installati.

Il fuso orario è `Europe/Rome`. Se ti serve un fuso diverso, cambia `timeZone` in `appsscript.json` prima del push.

## Configurazione

Tutte le impostazioni sono proprietà dello script, quindi non serve toccare il codice:

| Proprietà     | Obbligatoria | Significato |
|---------------|--------------|-------------|
| `ICAL_URL`    | sì           | Link iCalendar dell'orario. |
| `CALENDAR_ID` | no           | ID del calendario di destinazione (Impostazioni del calendario → Integra calendario). Se manca, usa il calendario principale. |
| `SYNC_HOUR`   | no           | Ora (0–23) della sincronizzazione della domenica. Predefinita: `18`. |
| `CHECK_HOUR`  | no           | Ora (0–23) del controllo dal lunedì al sabato. Predefinita: `7`. |
| `EVENT_COLOR` | no           | Colore delle lezioni, uno dei nomi di [`CalendarApp.EventColor`](https://developers.google.com/apps-script/reference/calendar/event-color) (`BLUE`, `PALE_RED`, `GREEN`…). Predefinito: `BLUE`, cioè "Mirtillo". |

Dopo aver cambiato `SYNC_HOUR` o `CHECK_HOUR`, riesegui `installTriggers`. Tutte le lezioni hanno lo stesso colore. Nel calendario web puoi dare a quel colore un'etichetta, per esempio "Università" (menu colore di un evento → modifica etichetta).

## Come funziona

- **Domenica tra le 18 e le 19** (o all'ora `SYNC_HOUR`) `syncNextWeek` sincronizza la settimana da lunedì a domenica.
- **Dal lunedì al sabato verso le 7** (o all'ora `CHECK_HOUR`) `checkThisWeek` ricontrolla le lezioni da oggi a domenica. Apps Script non garantisce il minuto esatto.
- Ogni evento creato porta un tag privato (`uni_timetable_uid`) con l'UID della fonte. La sincronizzazione crea, aggiorna e rimuove solo gli eventi con quel tag e non tocca mai il resto del calendario. Rieseguirla non crea duplicati.
- EasyCourse mette orario e aula nell'UID. Se uno dei due cambia, nei log la variazione compare come coppia "rimossa" + "nuova".
- Se il download o il formato del file falliscono, la sincronizzazione si ferma senza cancellare nulla.
- Non vengono importati gli eventi di giornata intera né le festività EasyCourse (00:00–24:00).

Il pannello web (`doGet`) è facoltativo. Per usarlo crea una distribuzione **App web** dall'editor: offre anteprima, sincronizzazione manuale, installazione dei trigger e verifica.

## Sviluppo

```bash
pnpm type-check
pnpm test
pnpm build      # dist/Code.gs + dist/Dashboard.html
pnpm push       # build + clasp push (richiede clasp installato e .clasp.json)
```

- `src/server/ical.ts`: parsing iCalendar (puro, testato in `tests/`).
- `src/server/index.ts`: fetch, sincronizzazione, trigger e funzioni esposte.
- `src/client/`: pannello React.
- `scripts/build.mjs`: bundle per Apps Script.

### Deploy automatico (facoltativo)

`.github/workflows/deploy.yml` esegue type-check e test a ogni push e pull request. Se la variabile del repo `SCRIPT_ID` è impostata, a ogni push su `main` carica anche il codice con clasp. Per attivarlo nel tuo fork:

```bash
gh variable set SCRIPT_ID --body "<id dello script>"
gh variable set DEPLOYMENT_ID --body "<id della distribuzione App web>"   # facoltativa
gh secret set CLASPRC_JSON < ~/.clasprc.json
```

Se il login clasp scade, ripeti `clasp login` e aggiorna il secret.

## Limiti noti

- Gli orari con `TZID` sono letti nel fuso dello script; quelli in UTC (`Z`) sono convertiti correttamente.

## Licenza

[MIT](LICENSE)
