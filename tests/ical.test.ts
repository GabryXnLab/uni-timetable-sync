import { describe, expect, it } from 'vitest';
import { parseIcal } from '../src/server/ical';

const calendar = (...events: string[][]) => ['BEGIN:VCALENDAR', ...events.flatMap(event => ['BEGIN:VEVENT', ...event, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');

describe('esportazione EasyCourse', () => {
  it('estrae materia, docente, aula e orari da una lezione con riga ripiegata', () => {
    const source = calendar(
      [
        'UID:lezione-1@ateneo',
        'DTSTART:20260922T081500',
        'DTEND:20260922T111500',
        'SUMMARY:GEOMETRIA (Cognomi A-D) - B000001 ROSSI MARIO Aula 001 [Polo ',
        ' Didattico (Piano Terra)] Lezione',
      ],
      [
        'UID:festivo@ateneo',
        'DTSTART:20261208T000000',
        'DTEND:20261208T240000',
        'SUMMARY:FESTIVITÀ:lezioni non previste',
      ],
    );
    const lessons = parseIcal(source);
    expect(lessons).toHaveLength(1);
    expect(lessons[0]).toMatchObject({
      uid: 'lezione-1@ateneo',
      title: 'GEOMETRIA',
      location: 'Aula 001 [Polo Didattico (Piano Terra)]',
    });
    expect(lessons[0].description).toContain('Docente: ROSSI MARIO');
    expect(lessons[0].description).toContain('Insegnamento: GEOMETRIA (Cognomi A-D)');
    expect(lessons[0].description).toContain('Tipo: Lezione');
    expect(lessons[0].start.getHours()).toBe(8);
    expect(lessons[0].start.getMinutes()).toBe(15);
  });

  it('rifiuta una risposta HTML al posto del calendario', () => {
    expect(() => parseIcal('<html>Login</html>')).toThrow('non valida');
  });

  it('toglie qualsiasi partizione per cognome dal titolo', () => {
    const source = calendar([
      'UID:nuova-materia@ateneo',
      'DTSTART:20270302T081500',
      'DTEND:20270302T101500',
      'SUMMARY:TERMODINAMICA APPLICATA (Cognomi E-L) - C123456 BIANCHI ANNA Aula 007 [Polo Didattico] Lezione',
    ]);
    expect(parseIcal(source)[0]).toMatchObject({
      title: 'TERMODINAMICA APPLICATA',
      location: 'Aula 007 [Polo Didattico]',
    });
  });
});

describe('iCalendar generico', () => {
  it('usa SUMMARY, LOCATION e DESCRIPTION quando il formato non è EasyCourse', () => {
    const source = calendar([
      'UID:abc@altro',
      'DTSTART:20260922T090000',
      'DTEND:20260922T110000',
      'SUMMARY:Analisi 1',
      'LOCATION:Aula Magna\\, Edificio B',
      'DESCRIPTION:Prof. Verdi\\nEsercitazione',
    ]);
    expect(parseIcal(source)[0]).toMatchObject({
      title: 'Analisi 1',
      location: 'Aula Magna, Edificio B',
      description: 'Prof. Verdi\nEsercitazione',
    });
  });

  it('interpreta gli orari UTC e ignora gli eventi di giornata intera', () => {
    const source = calendar(
      ['UID:utc@altro', 'DTSTART:20260922T070000Z', 'DTEND:20260922T090000Z', 'SUMMARY:Fisica'],
      ['UID:giorno@altro', 'DTSTART;VALUE=DATE:20260923', 'DTEND;VALUE=DATE:20260924', 'SUMMARY:Vacanza'],
    );
    const lessons = parseIcal(source);
    expect(lessons).toHaveLength(1);
    expect(lessons[0].start.toISOString()).toBe('2026-09-22T07:00:00.000Z');
  });
});
