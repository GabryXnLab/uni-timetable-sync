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

// Gli orari senza "Z" sono interpretati nel fuso dello script; gli eventi di giornata intera (solo data) non sono lezioni.
function parseDate(raw: string): Date | null {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/.exec(raw);
  if (!match) return null;
  const parts = [Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0)] as const;
  const date = match[7] ? new Date(Date.UTC(...parts)) : new Date(...parts);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Formato EasyCourse (Kairos e altri atenei): "MATERIA (Cognomi A-D) - CODICE DOCENTE Aula X [Edificio] Tipo".
function easyCourseLesson(summary: string): Pick<Lesson, 'title' | 'location' | 'description'> | null {
  const match = /^(.+?) - ([A-Z][A-Z0-9]{3,})\s+(.+)$/.exec(summary);
  if (!match) return null;
  const room = /\b(Aula\s+[^\[]+\[[^\]]+\])/.exec(match[3]);
  const location = room ? room[1].trim() : '';
  const teacher = room ? match[3].slice(0, room.index).trim() : match[3].replace(/\s+Lezione$/, '').trim();
  const kind = room ? match[3].slice(room.index + room[0].length).trim() : '';
  const description = [
    `Insegnamento: ${match[1]}`,
    `Codice: ${match[2]}`,
    teacher ? `Docente: ${teacher}` : '',
    location ? `Aula: ${location}` : '',
    kind ? `Tipo: ${kind}` : '',
  ].filter(Boolean).join('\n');
  return { title: match[1].replace(/\s*\(Cognomi\s+[^)]*\)\s*$/i, '').trim(), location, description };
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
        const summary = unescapeIcal(fields.SUMMARY || '').trim();
        const start = parseDate(fields.DTSTART || '');
        const end = parseDate(fields.DTEND || '');
        const uid = fields.UID || '';
        const notes = unescapeIcal(fields.DESCRIPTION || '').trim();
        // EasyCourse esporta festività e sospensioni come eventi 00:00–24:00.
        if (summary && start && end && end > start && uid && !fields.DTEND?.endsWith('T240000')) {
          const parsed = easyCourseLesson(summary);
          if (parsed) {
            const description = [parsed.description, notes ? `Note: ${notes}` : '', `Dettagli originali: ${summary}`].filter(Boolean).join('\n');
            lessons.push({ uid, start, end, ...parsed, location: parsed.location || unescapeIcal(fields.LOCATION || '').trim(), description });
          } else {
            lessons.push({ uid, start, end, title: summary, location: unescapeIcal(fields.LOCATION || '').trim(), description: notes });
          }
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
