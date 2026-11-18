import superjson from "superjson";
import { enqueueOutbox, flushOutbox } from "./offlineOutbox";

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

export const getAttendance = async (institutionId: string, classId: string, date: string) =>
  (await call<{ students: any[] }>(`/_api/attendance/list?institutionId=${encodeURIComponent(institutionId)}&classId=${encodeURIComponent(classId)}&date=${date}`)).students || [];

export async function saveAttendance(input: AttendanceInput): Promise<{ saved: number; queued?: boolean }> {
  // Persist first, then send. The same outbox id is reused as the server idempotency key on retries.
  await enqueueOutbox(ATTENDANCE_SCOPE, input);
  const result = await syncAttendanceOutbox();
  return result.sent > 0
    ? { saved: input.records.length }
    : { saved: input.records.length, queued: true };
}
