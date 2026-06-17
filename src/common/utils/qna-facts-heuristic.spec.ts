import { extractTreatmentKeyword } from './qna-facts-heuristic';

describe('qna-facts-heuristic', () => {
  it('extracts treatment keywords (multi-word, infusion, single)', () => {
    expect(extractTreatmentKeyword('כמה פט סיטי יש?')).toBe('פט סיטי');
    expect(extractTreatmentKeyword('מה צריך לדעת לפני עירוי זומרה?')).toBe(
      'זומרה',
    );
    expect(extractTreatmentKeyword('כמה עירויי קיטרודה היו?')).toBe('קיטרודה');
    expect(extractTreatmentKeyword('מתי התור הבא?')).toBeNull();
  });
});
