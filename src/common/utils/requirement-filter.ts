/** Appointment-field admin — not a family prep to-do. */
const ADMIN_REQUIREMENT_RE =
  /(?:עדכון|עדכן|לעדכן|הוספת|להוסיף|לקבוע|לתאם)\s+(?:את\s+)?(?:ה)?(?:שעה|מיקום|תאריך|תור|מועד)/iu;

export function isRealRequirement(description: string): boolean {
  const d = description.trim();
  if (!d) {
    return false;
  }
  return !ADMIN_REQUIREMENT_RE.test(d);
}

export function filterExtractedRequirements(
  requirements: { description: string }[] | undefined,
): { description: string }[] {
  if (!requirements?.length) {
    return [];
  }
  return requirements.filter((r) => isRealRequirement(r.description));
}
