import superjson from "superjson";
import { z } from "zod";

export const materialInputSchema = z.object({
  institutionId: z.string().uuid(),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().max(2000).optional().default(""),
  subject: z.string().trim().max(120).optional().default(""),
  grade: z.number().int().min(1).max(11).nullable().optional(),
  materialType: z.enum(["lesson", "pdf", "book", "video", "link"]),
  resourceUrl: z.string().min(8).max(2048),
  academicYear: z.string().regex(/^20[0-9]{2}-20[0-9]{2}$/).default("2026-2027"),
});
export type MaterialInput = z.infer<typeof materialInputSchema>;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init });
  const data = superjson.parse<any>(await response.text());
  if (!response.ok) throw new Error(data.message || "Амалиёт иҷро нашуд.");
  return data as T;
}

export async function getMaterials(institutionId: string, grade?: string) {
  const params = new URLSearchParams({ institutionId });
  if (grade && grade !== "all") params.set("grade", grade);
  return (await request<{ materials: any[] }>(`/_api/materials/list?${params}`)).materials || [];
}

export async function addMaterial(input: MaterialInput) {
  return request<{ material: any }>("/_api/materials/create", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: superjson.stringify(materialInputSchema.parse(input)),
  });
}

export async function updateMaterial(input: { institutionId: string; materialId: string; title: string; description: string; subject: string; grade: number | null; materialType: "lesson" | "pdf" | "book" | "video" | "link"; academicYear: string; isPublished: boolean }) {
  return request<{ material: any }>("/_api/materials/update", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: superjson.stringify(input),
  });
}

export async function uploadMaterialFile(institutionId: string, file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const contentTypes: Record<string, string[]> = {
    pdf: ["application/pdf"], doc: ["application/msword", "application/octet-stream"],
    docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream"],
    ppt: ["application/vnd.ms-powerpoint", "application/octet-stream"],
    pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/octet-stream"],
  };
  if (!contentTypes[extension]?.includes(file.type || "application/octet-stream")) throw new Error("Навъи файл иҷозат дода нашудааст.");
  if (file.size <= 0 || file.size > 30 * 1024 * 1024) throw new Error("Ҳаҷми файл бояд аз 30 МБ зиёд набошад.");
  const ticket = await request<{ filename: string; presignedUrl: string; headers: Record<string, string> }>("/_api/materials/presign", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: superjson.stringify({ institutionId, fileName: file.name, contentType: file.type || "application/octet-stream", sizeBytes: file.size }),
  });
  const uploaded = await fetch(ticket.presignedUrl, { method: "PUT", headers: ticket.headers, body: file });
  if (!uploaded.ok) throw new Error(uploaded.status === 412 ? "Ин номи файл аллакай истифода шудааст. Аз нав кӯшиш кунед." : "Боркунии файл ноком шуд. Пайвастшавиро санҷед.");
  return `storage://${ticket.filename}`;
}
