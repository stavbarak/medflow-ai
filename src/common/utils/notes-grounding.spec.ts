import { filterMergedNotes, filterNotesToSourceText } from './notes-grounding';

const USER_MSG =
  'לאבא יש תור ב-5.8 לעירוי זומרה באיכילוב בשעה 17:00. במהלך השבוע שלפני יש לעשות בדיקות דם: ספירת דם וביוכימיה. סידן וקריאטנין. לשלוח תוצאות למייל של אנסטסיה מהאונקולוגית.';

describe('filterNotesToSourceText', () => {
  it('removes hallucinated private-car transport', () => {
    const aiNotes =
      'ההגעה במכונית פרטית. לשלוח תוצאות בדיקות למייל של אנסטסיה מהאונקולוגית.';
    const filtered = filterNotesToSourceText(aiNotes, USER_MSG);
    expect(filtered).not.toMatch(/מכונית|פרטית/);
    expect(filtered).toMatch(/אנסטסיה|תוצאות/);
  });

  it('keeps transport only when user mentioned it', () => {
    const msg = 'יגיע במונית ועדי איתו';
    const notes = 'יגיע במונית. עדי תלווה.';
    expect(filterNotesToSourceText(notes, msg)).toMatch(/מונית/);
  });
});

describe('filterMergedNotes', () => {
  it('drops new hallucinated sentences while keeping existing', () => {
    const existing = 'שירי תלווה';
    const merged = 'שירי תלווה\nההגעה במכונית פרטית';
    const out = filterMergedNotes(existing, merged, 'שירי תיקח אותו');
    expect(out).not.toMatch(/מכונית/);
    expect(out).toMatch(/שירי|עדי/);
  });
});
