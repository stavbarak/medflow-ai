const AFFIRMATION_RE =
  /^(?:כן|בטח|אישור|מאשר|מאשרת|אשר|לבטל|בטל|תבטל|תבטלי|אוקיי|אוקי|אוקייי|סבבה|יאללה|ok|okay|yes|yep|sure)[\s!.…]*$/iu;

/** True when a short reply clearly affirms a pending yes/no confirmation. */
export function isAffirmation(text: string): boolean {
  return AFFIRMATION_RE.test(text.trim());
}
