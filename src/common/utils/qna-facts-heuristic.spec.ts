import { extractTreatmentKeyword, keywordCountForQuestion } from './qna-facts-heuristic';

describe('qna-facts-heuristic', () => {
  it('extracts treatment keywords (multi-word, infusion, single)', () => {
    expect(extractTreatmentKeyword('כמה פט סיטי יש?')).toBe('פט סיטי');
    expect(extractTreatmentKeyword('מה צריך לדעת לפני עירוי זומרה?')).toBe(
      'זומרה',
    );
    expect(extractTreatmentKeyword('כמה עירויי קיטרודה היו?')).toBe('קיטרודה');
    expect(extractTreatmentKeyword('מתי התור הבא?')).toBeNull();
  });

  it('picks throughEndOfToday when the question includes today', () => {
    const buckets = {
      beforeNow: 1,
      fromNowOn: 1,
      throughEndOfToday: 2,
      totalMatching: 2,
    };
    expect(
      keywordCountForQuestion('כמה קיטרודה היו? כולל היום', buckets),
    ).toBe(2);
    expect(keywordCountForQuestion('כמה קיטרודה היו?', buckets)).toBe(1);
  });
});
