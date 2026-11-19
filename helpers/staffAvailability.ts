export type StaffAvailabilityRule = { staffId: string; weekday: number; shiftNumber: number; lessonNumber: number; };

/** shiftNumber 0 applies to both shifts; lessonNumber 0 applies to the whole day. */
export function isStaffUnavailable(rules: readonly StaffAvailabilityRule[], staffId: string, weekday: number, shiftNumber: number, lessonNumber: number): boolean {
  return rules.some((rule) => rule.staffId === staffId && rule.weekday === weekday &&
    (rule.shiftNumber === 0 || rule.shiftNumber === shiftNumber) &&
    (rule.lessonNumber === 0 || rule.lessonNumber === lessonNumber));
}
