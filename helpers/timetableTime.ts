/**
 * Internal school bell schedule. These values are used only for conflict checks;
 * they are never rendered in the timetable or its print template.
 * Both shifts have 45-minute lessons. Breaks: 5, 5, 10, then 5 minutes.
 */
export function timetableLessonInterval(shiftNumber: number, lessonNumber: number): { start: number; end: number } {
  if (![1, 2].includes(shiftNumber) || !Number.isInteger(lessonNumber) || lessonNumber < 1) {
    throw new Error("INVALID_TIMETABLE_SLOT");
  }
  let start = shiftNumber === 1 ? 8 * 60 : 13 * 60;
  for (let lesson = 1; lesson < lessonNumber; lesson++) {
    start += 45;
    start += lesson === 3 ? 10 : 5;
  }
  return { start, end: start + 45 };
}

/** Half-open intervals: a lesson ending at 13:00 does not overlap one starting at 13:00. */
export function timetableLessonsOverlap(shiftA: number, lessonA: number, shiftB: number, lessonB: number): boolean {
  const a = timetableLessonInterval(shiftA, lessonA);
  const b = timetableLessonInterval(shiftB, lessonB);
  return a.start < b.end && b.start < a.end;
}
