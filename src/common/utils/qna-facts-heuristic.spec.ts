import {
  extractTreatmentKeyword,
  isCountQuestion,
  isPastOrSoFarQuestion,
  isPrepQuestion,
  needsExpandedFacts,
} from './qna-facts-heuristic';

describe('qna-facts-heuristic', () => {
  it('detects past/"so far" questions', () => {
    expect(isPastOrSoFarQuestion('כמה עירויים כבר היו?')).toBe(true);
    expect(isPastOrSoFarQuestion('מה היה בעבר?')).toBe(true);
    expect(isPastOrSoFarQuestion('מתי התור הבא?')).toBe(false);
  });

  it('detects count and prep questions', () => {
    expect(isCountQuestion('כמה פט סיטי יש?')).toBe(true);
    expect(isCountQuestion('מתי התור הבא?')).toBe(false);
    expect(isPrepQuestion('מה צריך להביא?')).toBe(true);
    expect(isPrepQuestion('מה צריך לדעת לפני עירוי זומרה?')).toBe(true);
    expect(isPrepQuestion('מי האחראי?')).toBe(false);
  });

  it('extracts treatment keywords (multi-word, infusion, single)', () => {
    expect(extractTreatmentKeyword('כמה פט סיטי יש?')).toBe('פט סיטי');
    expect(extractTreatmentKeyword('מה צריך לדעת לפני עירוי זומרה?')).toBe(
      'זומרה',
    );
    expect(extractTreatmentKeyword('כמה עירויי קיטרודה היו?')).toBe('קיטרודה');
    expect(extractTreatmentKeyword('מתי התור הבא?')).toBeNull();
  });

  it('needsExpandedFacts is true for past/count/prep/treatment questions', () => {
    expect(needsExpandedFacts('כמה פט סיטי יש?')).toBe(true);
    expect(needsExpandedFacts('מה צריך לדעת לפני עירוי זומרה?')).toBe(true);
    expect(needsExpandedFacts('כמה עירויים כבר היו?')).toBe(true);
    expect(needsExpandedFacts('מתי התור הבא?')).toBe(false);
    expect(needsExpandedFacts('מי מסיע את אבא?')).toBe(false);
  });
});
