/**
 * Heuristics to decide whether a message is actually talking about transport.
 * We use this as a guardrail against model hallucinations on writes.
 */

const TRANSPORT_RE =
  /(הסעה|מונית|נהג|נהגת|להסיע|יסיע|תסיע|יקח|ייקח|תקח|תיקח|אוסף|יאסוף|לאסוף|להחזיר|תחזיר|חוזר|חזרה|נסיעה)/iu;

export function textMentionsTransport(text: string): boolean {
  return TRANSPORT_RE.test(text);
}

