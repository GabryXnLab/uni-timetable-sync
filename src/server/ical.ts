export interface Lesson {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  description: string;
  location: string;
}

function unescapeIcal(value: string): string {
  return value.replace(/\\[nN]/g, '\n').replace(/\\([,;\\])/g, '$1');
}

function localDate(raw: string): Date | null {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?$/.exec(raw);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseIcal(source: string): Lesson[] {
  if (!source.includes('BEGIN:VCALENDAR') || !source.includes('END:VCALENDAR')) throw new Error('Risposta iCalendar non valida');
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const unfolded: string[] = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && unfolded.length) unfolded[unfolded.length - 1] += line.slice(1);
    else unfolded.push(line);
  }
  const lessons: Lesson[] = [];
  let fields: Record<string, string> | null = null;
  for (const line of unfolded) {
    if (line === 'BEGIN:VEVENT') { fields = {}; continue; }
    if (line === 'END:VEVENT') {
      if (fields) {
        const summary = unescapeIcal(fields.SUMMARY || '');
        const start = localDate(fields.DTSTART || '');
        const end = localDate(fields.DTEND || '');
        const uid = fields.UID || '';
        // Le festività e le sospensioni sono eventi di giornata intera, non lezioni.
        const match = /^(.+?) - ([A-Z][A-Z0-9]{3,})\s+(.+)$/.exec(summary);
        if (match && start && end && end > start && uid) {
          const subject = match[1].replace(/\s*\(Cognomi\s+A\s*-\s*D\)\s*$/i, '').trim();
          const room = /\b(Aula\s+[^\[]+\[[^\]]+\])/.exec(match[3]);
          const location = room ? room[1].trim() : '';
          const teacher = room ? match[3].slice(0, room.index).trim() : match[3].replace(/\s+Lezione$/, '').trim();
          const kind = room ? match[3].slice(room.index + room[0].length).trim() : '';
          const detail = [
            `Insegnamento: ${match[1]}`,
            `Codice: ${match[2]}`,
            teacher ? `Docente: ${teacher}` : '',
            location ? `Aula: ${location}` : '',
            kind ? `Tipo: ${kind}` : '',
            fields.DESCRIPTION ? `Note: ${unescapeIcal(fields.DESCRIPTION)}` : '',
            `Dettagli Kairos: ${summary}`,
            `Fonte: https://kairos.unifi.it/agendaweb/`,
          ].filter(Boolean).join('\n');
          lessons.push({ uid, title: subject, start, end, description: detail, location });
        } else if (start && end && end > start && !fields.DTEND?.endsWith('T240000')) {
          throw new Error(`Evento Kairos non riconosciuto: ${summary.slice(0, 100)}`);
        }
      }
      fields = null;
      continue;
    }
    if (fields) {
      const colon = line.indexOf(':');
      if (colon > 0) fields[line.slice(0, colon).split(';')[0]] = line.slice(colon + 1);
    }
  }
  if (!lessons.length) throw new Error('Il calendario iCal non contiene lezioni riconoscibili');
  return lessons;
}
