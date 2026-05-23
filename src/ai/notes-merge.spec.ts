import { parseNotesMergeResponse } from './notes-merge';

describe('parseNotesMergeResponse', () => {
  it('accepts notes string', () => {
    expect(parseNotesMergeResponse({ notes: 'שירי תיקח ותחזיר' })).toBe(
      'שירי תיקח ותחזיר',
    );
  });

  it('rejects invalid shapes', () => {
    expect(parseNotesMergeResponse({ notes: 1 })).toBeNull();
    expect(parseNotesMergeResponse(null)).toBeNull();
  });
});
