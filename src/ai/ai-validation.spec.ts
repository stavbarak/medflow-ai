import { validateAppointmentExtraction } from './ai-validation';

describe('validateAppointmentExtraction', () => {
  it('accepts valid partial payloads', () => {
    const dto = validateAppointmentExtraction({
      title: 'MRI',
      dateTime: '2026-06-01T08:00:00.000Z',
      location: 'תל השומר',
    });
    expect(dto.title).toBe('MRI');
  });
});
