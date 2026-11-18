import superjson from "superjson";
import { enqueueOutbox, flushOutbox, listOutbox } from "./offlineOutbox";
import { getAttendanceRosterCache, saveAttendanceRosterCache } from "./attendanceRosterCache";

type AttendanceInput = {
  institutionId: string;
  classId: string;
  date: string;
  records: { studentId: string; status: "present" | "absent" | "late" | "excused"; note?: string }[];
};

const ATTENDANCE_SCOPE = "attendance.save";

async function call<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...(body ? {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: superjson.stringify(body),
    } : {}),
  });
  const data = superjson.parse<any>(await response.text());
  if (!response.ok) throw new Error(data.message || "Амалиёт иҷро нашуд.");
  return data as T;
}

async function sendAttendance(operationId: string, payload: AttendanceInput): Promise<void> {
  const response = await fetch("/_api/attendance/save", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": operationId,
    },
    body: superjson.stringify(payload),
  });
  const data = superjson.parse<any>(await response.text());
  if (!response.ok) throw new Error(data.message || `Сабти давомот иҷро нашуд (HTTP ${response.status}).`);
}

export async function syncAttendanceOutbox(): Promise<{ sent: number; failed: number }> {
  return flushOutbox(async (operationId, scope, payload) => {
    if (scope !== ATTENDANCE_SCOPE) throw new Error("Навъи амалиёти офлайн дастгирӣ намешавад.");
    await sendAttendance(operationId, payload as AttendanceInput);
  }, ATTENDANCE_SCOPE);
}

export async function getAttendance(institutionId: string, classId: string, date: string, userId: number) {
  const url = `/_api/attendance/list?institutionId=${encodeURIComponent(institutionId)}&classId=${encodeURIComponent(classId)}&date=${date}`;
  try {
    const students = (await call<{ students: any[] }>(url)).students || [];
    // Cache only the fields needed by the attendance screen, never guardian or contact data.
    const safeRoster = students.map(({ studentId, fullName, studentNumber, status, note }) => ({
      studentId, fullName, studentNumber, status, note,
    }));
    try {
      await saveAttendanceRosterCache(userId, institutionId, classId, date, safeRoster);
    } catch {
      // A cache failure must not turn a successful online read into a failed page load.
    }
    return safeRoster;
  } catch (error) {
    // Never use cached data after an authorization or validation response.
    const isNetworkFailure = error instanceof TypeError ||
      (typeof navigator !== "undefined" && navigator.onLine === false);
    if (!isNetworkFailure) throw error;
    const cached = await getAttendanceRosterCache<any[]>(userId, institutionId, classId, date);
    if (!cached) throw error;
    return cached.value;
  }
}

export async function saveAttendance(input: AttendanceInput): Promise<{ saved: number; queued?: boolean }> {
  // Persist first, then send. The same outbox id is reused as the server idempotency key on retries.
  const entry = await enqueueOutbox(ATTENDANCE_SCOPE, input);
  await syncAttendanceOutbox();
  const remaining = await listOutbox(ATTENDANCE_SCOPE);
  return remaining.some((item) => item.id === entry.id)
    ? { saved: input.records.length, queued: true }
    : { saved: input.records.length };
}
