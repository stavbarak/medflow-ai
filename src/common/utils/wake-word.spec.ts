import { classifyWakePayload } from '../../whatsapp/whatsapp-wake-intent';
import { stripWakeWord } from './wake-word';

describe('stripWakeWord', () => {
  it('returns empty for wake word with punctuation only', () => {
    expect(stripWakeWord('חנטריש')).toBe('');
    expect(stripWakeWord('חנטריש!')).toBe('');
    expect(stripWakeWord('חנטריש?')).toBe('');
    expect(stripWakeWord('חנטריש,')).toBe('');
    expect(stripWakeWord('חנטריש...')).toBe('');
  });

  it('returns empty for wake word plus greeting only', () => {
    expect(stripWakeWord('חנטריש שלום')).toBe('');
    expect(stripWakeWord('חנטריש, שלום!')).toBe('');
    expect(stripWakeWord('חנטריש שבוע טוב')).toBe('');
    expect(stripWakeWord('שלום חנטריש')).toBe('');
    expect(stripWakeWord('היי חנטריש')).toBe('');
  });

  it('keeps substantive payload after wake word', () => {
    expect(stripWakeWord('חנטריש מה התורים?')).toBe('מה התורים?');
    expect(stripWakeWord('שלום חנטריש, מה התורים?')).toBe('מה התורים?');
    expect(stripWakeWord('חנטריש, לאבא יש תור ב-27.5')).toBe(
      'לאבא יש תור ב-27.5',
    );
  });
});

describe('stripWakeWord + classifyWakePayload', () => {
  it('lists appointments for punctuation and greeting-only messages', () => {
    for (const text of ['חנטריש!', 'חנטריש?', 'חנטריש שלום', 'שלום חנטריש']) {
      expect(classifyWakePayload(stripWakeWord(text))).toBe('list');
    }
  });
});
