import { textMentionsTransport } from './transport-heuristic';

describe('textMentionsTransport', () => {
  it('detects transport verbs and keywords', () => {
    expect(textMentionsTransport('שירי תסיע אותו לתור')).toBe(true);
    expect(textMentionsTransport('מונית אחרי התור')).toBe(true);
    expect(textMentionsTransport('תחזיר אחרי התור')).toBe(true);
  });

  it('does not trigger on typical appointment text', () => {
    expect(textMentionsTransport('תוסיף תור לאונקולוג ב 1.8 בשעה 13:00')).toBe(
      false,
    );
  });
});

