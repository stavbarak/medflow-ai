import {
  filterExtractedRequirements,
  isRealRequirement,
} from './requirement-filter';

describe('requirement-filter', () => {
  it('rejects appointment admin masquerading as checklist items', () => {
    expect(isRealRequirement('עדכון השעה לאקו לב')).toBe(false);
    expect(isRealRequirement('הוספת מיקום: המרפאה בפרדס חנה')).toBe(false);
  });

  it('keeps real prep to-dos', () => {
    expect(isRealRequirement('טופס 17')).toBe(true);
    expect(isRealRequirement('בדיקת דם לפני התור')).toBe(true);
  });

  it('filters arrays in place', () => {
    expect(
      filterExtractedRequirements([
        { description: 'עדכון השעה לאקו לב' },
        { description: 'טופס 17' },
      ]),
    ).toEqual([{ description: 'טופס 17' }]);
  });
});
