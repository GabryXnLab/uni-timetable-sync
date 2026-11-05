import { parseIcal, type Lesson } from './ical';

// Il fuso si cambia in appsscript.json: i giorni sono calcolati con new Date(y, m, d), che usa il fuso dello script.
const ZONE = Session.getScriptTimeZone();
const TAG = 'uni_timetable_uid';

function property(name: string): string {
  return (PropertiesService.getScriptProperties().getProperty(name) || '').trim();
}

function sourceSetting(): string {
  const url = property('ICAL_URL');
  if (!/^https?:\/\//.test(url)) throw new Error('Imposta la proprietà dello script ICAL_URL con il link iCalendar del tuo orario');
  return url;
}

// Google Calendar permette di associare un'etichetta a ogni colore: tutte le lezioni usano lo stesso.
function color(): string {
  const name = (property('EVENT_COLOR') || 'BLUE').toUpperCase();
  const colors = CalendarApp.EventColor as unknown as Record<string, GoogleAppsScript.Calendar.EventColor>;
  if (!(name in colors)) throw new Error(`EVENT_COLOR non valido: ${name}. Valori ammessi: ${Object.keys(colors).join(', ')}`);
  return String(colors[name]);
}

interface Week {
  start: Date;
  end: Date;
  label: string;
}

function nextWeek(now = new Date()): Week {
  const today = Utilities.formatDate(now, ZONE, 'yyyy-MM-dd');
  const [year, month, day] = today.split('-').map(Number);
  const midnight = new Date(year, month - 1, day);
  const daysToMonday = ((8 - midnight.getDay()) % 7) || 7;
  const start = new Date(year, month - 1, day + daysToMonday);
  const end = new Date(year, month - 1, day + daysToMonday + 7);
  return { start, end, label: Utilities.formatDate(start, ZONE, 'dd/MM/yyyy') + '–' + Utilities.formatDate(new Date(end.getTime() - 86400000), ZONE, 'dd/MM/yyyy') };
}

function restOfThisWeek(now = new Date()): Week {
  const today = Utilities.formatDate(now, ZONE, 'yyyy-MM-dd');
  const [year, month, day] = today.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + (((8 - start.getDay()) % 7) || 7));
  return { start, end, label: Utilities.formatDate(start, ZONE, 'dd/MM/yyyy') + '–' + Utilities.formatDate(new Date(end.getTime() - 86400000), ZONE, 'dd/MM/yyyy') };
}

function sourceUrl(date: Date): string {
  const chosen = Utilities.formatDate(date, ZONE, 'yyyy-MM-dd');
  // EasyCourse esporta solo il periodo attorno al parametro date: va spostato sulla settimana richiesta.
  return sourceSetting().replace(/([?&]date=)[^&]*/, `$1${chosen}`);
}

function fetchLessons(week: Week): Lesson[] {
  const response = UrlFetchApp.fetch(sourceUrl(week.start), {
    followRedirects: true,
    muteHttpExceptions: true,
    headers: { Accept: 'text/calendar' },
  });
  if (response.getResponseCode() !== 200) throw new Error(`Fonte iCalendar HTTP ${response.getResponseCode()}`);
  const body = response.getContentText('UTF-8');
  if (body.length > 2_000_000) throw new Error('Esportazione iCalendar troppo grande');
  return parseIcal(body).filter(lesson => lesson.start >= week.start && lesson.start < week.end);
}

function calendar(): GoogleAppsScript.Calendar.Calendar {
  const id = property('CALENDAR_ID');
  const chosen = id ? CalendarApp.getCalendarById(id) : CalendarApp.getDefaultCalendar();
  if (!chosen) throw new Error(`Calendario non trovato: ${id}`);
  return chosen;
}

function eventChanged(event: GoogleAppsScript.Calendar.CalendarEvent, lesson: Lesson, eventColor: string): boolean {
  return event.getTitle() !== lesson.title ||
    event.getStartTime().getTime() !== lesson.start.getTime() ||
    event.getEndTime().getTime() !== lesson.end.getTime() ||
    event.getDescription() !== lesson.description ||
    event.getLocation() !== lesson.location ||
    event.getColor() !== eventColor;
}

function describe(title: string, start: Date, end: Date, location: string): string {
  return `${title} ${Utilities.formatDate(start, ZONE, 'EEE dd/MM HH:mm')}–${Utilities.formatDate(end, ZONE, 'HH:mm')} ${location}`;
}

export function previewNextWeek() {
  const week = nextWeek();
  const lessons = fetchLessons(week);
  Logger.log(JSON.stringify({ action: 'previewNextWeek', week: week.label, lessons: lessons.length }));
  return {
    week: week.label,
    count: lessons.length,
    lessons: lessons.map(lesson => ({
      uid: lesson.uid,
      title: lesson.title,
      start: Utilities.formatDate(lesson.start, ZONE, 'EEE dd/MM HH:mm'),
      end: Utilities.formatDate(lesson.end, ZONE, 'HH:mm'),
      location: lesson.location,
      description: lesson.description,
    })),
  };
}

function syncRange(week: Week, action: string) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Sincronizzazione già in corso');
  try {
    const lessons = fetchLessons(week);
    const target = calendar();
    const eventColor = color();
    const existing = target.getEvents(week.start, week.end).filter(event => !!event.getTag(TAG));
    const byUid = new Map<string, GoogleAppsScript.Calendar.CalendarEvent>();
    for (const event of existing) byUid.set(event.getTag(TAG), event);
    const changes: string[] = [];
    let created = 0;
    let updated = 0;
    let deleted = 0;
    for (const lesson of lessons) {
      const event = byUid.get(lesson.uid);
      if (event) {
        if (eventChanged(event, lesson, eventColor)) {
          event.setTitle(lesson.title);
          event.setTime(lesson.start, lesson.end);
          event.setDescription(lesson.description);
          event.setLocation(lesson.location);
          event.setColor(eventColor);
          changes.push('aggiornata: ' + describe(lesson.title, lesson.start, lesson.end, lesson.location));
          updated++;
        }
        byUid.delete(lesson.uid);
      } else {
        const added = target.createEvent(lesson.title, lesson.start, lesson.end, {
          description: lesson.description,
          location: lesson.location,
        });
        added.setTag(TAG, lesson.uid);
        added.setColor(eventColor);
        changes.push('nuova: ' + describe(lesson.title, lesson.start, lesson.end, lesson.location));
        created++;
      }
    }
    for (const obsolete of byUid.values()) {
      changes.push('rimossa: ' + describe(obsolete.getTitle(), obsolete.getStartTime() as Date, obsolete.getEndTime() as Date, obsolete.getLocation()));
      obsolete.deleteEvent();
      deleted++;
    }
    const result = { week: week.label, fetched: lessons.length, created, updated, deleted, changes };
    Logger.log(JSON.stringify({ action, ...result }));
    return result;
  } finally {
    lock.releaseLock();
  }
}

export function syncNextWeek() {
  return syncRange(nextWeek(), 'syncNextWeek');
}

// EasyCourse cambia UID quando cambiano aula o orario: una variazione compare come coppia "rimossa" + "nuova".
export function checkThisWeek() {
  if (Utilities.formatDate(new Date(), ZONE, 'u') === '7') {
    Logger.log(JSON.stringify({ action: 'checkThisWeek', skipped: 'domenica' }));
    return { skipped: true };
  }
  return syncRange(restOfThisWeek(), 'checkThisWeek');
}

const HANDLERS = ['syncNextWeek', 'checkThisWeek'];

function hour(name: string, fallback: number): number {
  const raw = property(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 23) throw new Error(`${name} non valido: ${raw}. Usa un'ora intera da 0 a 23`);
  return value;
}

export function installTriggers() {
  const syncHour = hour('SYNC_HOUR', 18);
  const checkHour = hour('CHECK_HOUR', 7);
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (HANDLERS.includes(trigger.getHandlerFunction())) ScriptApp.deleteTrigger(trigger);
  }
  ScriptApp.newTrigger('syncNextWeek').timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(syncHour).everyWeeks(1)
    .inTimezone(ZONE).create();
  // Apps Script non supporta i trigger giornalieri solo feriali: la domenica viene saltata in checkThisWeek.
  ScriptApp.newTrigger('checkThisWeek').timeBased()
    .everyDays(1).atHour(checkHour).nearMinute(0)
    .inTimezone(ZONE).create();
  const result = { installed: true, weeklySync: `Domenica ${syncHour}:00–${syncHour + 1}:00`, dailyCheck: `Lunedì–sabato verso le ${checkHour}:00`, timeZone: ZONE };
  Logger.log(JSON.stringify({ action: 'installTriggers', ...result }));
  return result;
}

export function getStatus() {
  const result = {
    triggerInstalled: HANDLERS.every(handler => ScriptApp.getProjectTriggers().some(trigger => trigger.getHandlerFunction() === handler)),
    calendar: calendar().getName(),
    nextWeek: nextWeek().label,
  };
  Logger.log(JSON.stringify({ action: 'getStatus', ...result }));
  return result;
}

export function verifySetup() {
  const week = nextWeek();
  const lessons = fetchLessons(week);
  const target = calendar();
  const eventColor = color();
  const managed = target.getEvents(week.start, week.end).filter(event => !!event.getTag(TAG));
  const byUid = new Map<string, GoogleAppsScript.Calendar.CalendarEvent>();
  const duplicates: string[] = [];
  for (const event of managed) {
    const uid = event.getTag(TAG);
    if (byUid.has(uid)) duplicates.push(uid);
    byUid.set(uid, event);
  }
  const missing: string[] = [];
  const outdated: string[] = [];
  for (const lesson of lessons) {
    const event = byUid.get(lesson.uid);
    if (!event) missing.push(lesson.title);
    else if (eventChanged(event, lesson, eventColor)) outdated.push(lesson.title);
    byUid.delete(lesson.uid);
  }
  const handlers = ScriptApp.getProjectTriggers().map(trigger => trigger.getHandlerFunction());
  const triggerCount = handlers.filter(handler => HANDLERS.includes(handler)).length;
  const result = {
    week: week.label,
    calendar: target.getName(),
    sourceLessons: lessons.length,
    calendarLessons: managed.length,
    triggerCount,
    missing,
    outdated,
    extra: [...byUid.values()].map(event => event.getTitle()),
    duplicateUids: duplicates,
    success: HANDLERS.every(handler => handlers.filter(h => h === handler).length === 1) && missing.length === 0 && outdated.length === 0 && byUid.size === 0 && duplicates.length === 0,
  };
  Logger.log(JSON.stringify({ action: 'verifySetup', ...result }));
  return result;
}

// Temporanea: porta al tag attuale gli eventi creati prima della rinomina del progetto. Da togliere dopo l'uso.
const LEGACY_TAG = 'unifi_meccanica_uid';

export function migrateLegacyEvents() {
  const target = calendar();
  const now = Date.now();
  const events = target.getEvents(new Date(now - 400 * 86400000), new Date(now + 400 * 86400000));
  const current = new Set(events.map(event => event.getTag(TAG)).filter(Boolean));
  let retagged = 0;
  let deleted = 0;
  for (const event of events) {
    const uid = event.getTag(LEGACY_TAG);
    if (!uid) continue;
    if (current.has(uid)) {
      event.deleteEvent();
      deleted++;
    } else {
      event.setTag(TAG, uid);
      event.deleteTag(LEGACY_TAG);
      retagged++;
    }
  }
  const result = { calendar: target.getName(), retagged, deleted };
  Logger.log(JSON.stringify({ action: 'migrateLegacyEvents', ...result }));
  return result;
}

export function doGet() {
  return HtmlService.createHtmlOutputFromFile('Dashboard').setTitle('Orario universitario');
}
