import { parseAppointmentUpdateResponse } from './appointment-update';

describe('parseAppointmentUpdateResponse', () => {
  it('parses telephonic visit with transport cleared', () => {
    const parsed = parseAppointmentUpdateResponse({
      location: 'טלפוני',
      transportDriver: null,
      transportNotes: null,
    });
    expect(parsed.location).toBe('טלפוני');
    expect(parsed.transportDriver).toBeNull();
    expect(parsed.transportNotes).toBeNull();
  });

  it('parses merged notes', () => {
    expect(
      parseAppointmentUpdateResponse({ notes: 'צום 6 שעות' }).notes,
    ).toBe('צום 6 שעות');
  });
});
