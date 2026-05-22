import {
  pickAppointmentForUpdate,
  resolveUpdateTarget,
} from './appointment-matcher';

describe('pickAppointmentForUpdate', () => {
  const base = {
    id: '1',
    notes: '',
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
