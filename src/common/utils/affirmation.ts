const AFFIRMATION_RE =
  /^(?:כן|בטח|אישור|מאשר|מאשרת|אשר|לבטל|בטל|תבטל|תבטלי|אוקיי|אוקי|אוקייי|סבבה|יאללה|ok|okay|yes|yep|sure)[\s!.…]*$/iu;

/** True when a short reply clearly affirms a pending yes/no confirmation. */
export function isAffirmation(text: string): boolean {
  return AFFIRMATION_RE.test(text.trim());
}

const DECLINE_RE =
  /^(?:לא|לא תודה|לא צריך|לא עכשיו|לא יודע|לא יודעת|עדיין לא|אחר כך|אחרי כך|בהמשך|no|nope|later)[\s!.…]*$/iu;

/** True when a short reply clearly declines / defers (e.g. "not now", "later"). */
export function isDecline(text: string): boolean {
  return DECLINE_RE.test(text.trim());
}
