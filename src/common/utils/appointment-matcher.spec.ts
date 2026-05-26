import {
  pickAppointmentForUpdate,
  resolveAppointmentCandidates,
  resolveUpdateTarget,
} from './appointment-matcher';
import { jerusalemLocalToUtc } from './appointment-datetime';

describe('pickAppointmentForUpdate', () => {
  const base = {
    id: '1',
    notes: '',
    transportNotes: '',
    createdAt: new Date('2026-05-20T20:00:00Z'),
    dateTime: new Date('2026-05-25T09:00:00Z'),
  };

  it('matches by clinic name in payload', () => {
    const chosen = pickAppointmentForUpdate(
      'התור במרפאה הפליאטיבית הוא בשעה 11:00',
      [
        {
          ...base,
          id: 'a',
          title: 'תור במרפאה הפליאטיבית',
          location: 'איכילוב',
        },
        {
          ...base,
          id: 'b',
          title: 'MRI',
          location: 'הדסה',
          createdAt: new Date('2026-05-21T20:00:00Z'),
        },
      ],
    );
    expect(chosen?.id).toBe('a');
  });

  it('asks to disambiguate when several appointments share a day', () => {
    const day = new Date('2026-05-25T09:00:00Z');
    const result = resolveUpdateTarget('תשנה את התור של ה-25.5 לשעה 11:00', [
      { ...base, id: 'a', title: 'תור א', location: 'איכילוב', dateTime: day },
      { ...base, id: 'b', title: 'תור ב', location: 'הדסה', dateTime: day },
    ]);
    expect(result.status).toBe('ambiguous');
    if (result.status === 'ambiguous') {
      expect(result.appointments).toHaveLength(2);
    }
  });

  it('resolves one slot by explicit time when several share a day', () => {
    const aug5noon = jerusalemLocalToUtc(2026, 8, 5, 12, 0);
    const aug5_1300 = jerusalemLocalToUtc(2026, 8, 5, 13, 0);
    const aug5_1745 = jerusalemLocalToUtc(2026, 8, 5, 17, 0);
    const result = resolveAppointmentCandidates(
      'תמחק תור לאונקולוג ב 5.8 בשעה 12:00',
      [
        {
          ...base,
          id: 'a',
          title: 'אונקולוג',
          location: 'ייקבע',
          dateTime: aug5noon,
        },
        {
          ...base,
          id: 'b',
          title: 'אונקולוג',
          location: 'ייקבע',
          dateTime: aug5_1300,
        },
        {
          ...base,
          id: 'c',
          title: 'עירוי זומרה',
          location: 'ייקבע',
          dateTime: aug5_1745,
        },
      ],
    );
    expect(result.status).toBe('resolved');
    if (result.status === 'resolved') {
      expect(result.appointment.id).toBe('a');
    }
  });

  it('does not pick a different hour when requested time is missing', () => {
    const aug5noon = jerusalemLocalToUtc(2026, 8, 5, 12, 0);
    const aug5_1300 = jerusalemLocalToUtc(2026, 8, 5, 13, 0);
    const result = resolveAppointmentCandidates(
      'תמחק תור לאונקולוג ב 5.8 בשעה 12:00',
      [
        {
          ...base,
          id: 'b',
          title: 'אונקולוג',
          location: 'ייקבע',
          dateTime: aug5_1300,
        },
        {
          ...base,
          id: 'c',
          title: 'עירוי זומרה',
          location: 'ייקבע',
          dateTime: aug5noon,
        },
      ],
    );
    expect(result.status).toBe('unresolved');
  });

  it('resolves by clinic when several on the same day', () => {
    const day = new Date('2026-05-25T09:00:00Z');
    const result = resolveUpdateTarget(
      'תשנה את התור במרפאה הפליאטיבית של ה-25.5 לשעה 11:00',
      [
        {
          ...base,
          id: 'a',
          title: 'תור במרפאה הפליאטיבית',
          location: 'איכילוב',
          dateTime: day,
        },
        { ...base, id: 'b', title: 'MRI', location: 'הדסה', dateTime: day },
      ],
    );
    expect(result.status).toBe('resolved');
    if (result.status === 'resolved') {
      expect(result.appointment.id).toBe('a');
    }
  });
});
