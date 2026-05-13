import { validateAppointmentExtraction } from './ai-validation';

describe('validateAppointmentExtraction', () => {
  it('accepts valid partial payloads', () => {
    const dto = validateAppointmentExtraction({
      title: 'MRI',
      dateTime: '2026-06-01T08:00:00.000Z',
      location: 'תל השומר',
      requirements: [{ description: 'טופס 17' }],
    });
    expect(dto.title).toBe('MRI');
    expect(dto.requirements).toHaveLength(1);
  });

  it('rejects invalid nested requirement', () => {
    expect(() =>
      validateAppointmentExtraction({
        requirements: [{ description: '' }],
      }),
    ).toThrow();
  });
});
