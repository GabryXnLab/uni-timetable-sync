import { describe, expect, it } from 'vitest';
import { parseIcal } from '../src/server/ical';

describe('esportazione Kairos', () => {
  it('estrae materia, docente, aula e orari da una lezione con riga ripiegata', () => {
    const source = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:lezione-1@unifi',
      'DTSTART:20260922T081500',
      'DTEND:20260922T111500',
      'SUMMARY:GEOMETRIA (Cognomi A-D) - B015801 BATTAGLIA FIAMMETTA Aula 001 [C.Didat.',
      ' Morgagni (Piano Terra)] Lezione',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:festivo@unifi',
      'DTSTART:20261208T000000',
      'DTEND:20261208T240000',
      'SUMMARY:FESTIVITÀ:lezioni non previste',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const lessons = parseIcal(source);
    expect(lessons).toHaveLength(1);
    expect(lessons[0]).toMatchObject({
      uid: 'lezione-1@unifi',
      title: 'GEOMETRIA',
      location: 'Aula 001 [C.Didat.Morgagni (Piano Terra)]',
    });
    expect(lessons[0].description).toContain('Docente: BATTAGLIA FIAMMETTA');
    expect(lessons[0].description).toContain('Insegnamento: GEOMETRIA (Cognomi A-D)');
    expect(lessons[0].description).toContain('Tipo: Lezione');
    expect(lessons[0].start.getHours()).toBe(8);
    expect(lessons[0].start.getMinutes()).toBe(15);
  });

  it('rifiuta una risposta HTML al posto del calendario', () => {
    expect(() => parseIcal('<html>Login</html>')).toThrow('non valida');
  });

  it('accetta una materia nuova senza un nome o prefisso di codice predefinito', () => {
    const source = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:nuova-materia@unifi',
      'DTSTART:20270302T081500',
      'DTEND:20270302T101500',
      'SUMMARY:TERMODINAMICA APPLICATA (Cognomi A-D) - C123456 ROSSI MARIA Aula 007 [C.Didat.Morgagni (Piano Terra)] Lezione',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    expect(parseIcal(source)[0]).toMatchObject({
      title: 'TERMODINAMICA APPLICATA',
      location: 'Aula 007 [C.Didat.Morgagni (Piano Terra)]',
    });
  });
});
