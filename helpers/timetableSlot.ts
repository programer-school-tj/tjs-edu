export function timetableSlotKey(entityId: string, shiftNumber: number, weekday: number, lessonNumber: number): string {
  return [entityId, shiftNumber, weekday, lessonNumber].join(":");
}
