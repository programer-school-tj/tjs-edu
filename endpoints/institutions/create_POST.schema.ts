import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  name: z.string().trim().min(3).max(180),
  institutionType: z.enum(["school", "lyceum", "gymnasium", "college", "university"]),
  region: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional().default(""),
  directorName: z.string().trim().min(3).max(160),
});
export type InstitutionInput = z.infer<typeof schema>;

export async function postInstitution(input: InstitutionInput) {
  const result = await fetch("/_api/institutions/create", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: superjson.stringify(schema.parse(input)) });
  const data = superjson.parse<{ institution?: unknown; message?: string }>(await result.text());
  if (!result.ok) throw new Error(data.message || "Сабти муассиса иҷро нашуд.");
  return data.institution;
}

export async function getInstitutions() {
  const result = await fetch("/_api/institutions/list", { credentials: "include" });
  const data = superjson.parse<{ institutions?: Array<any>; message?: string }>(await result.text());
  if (!result.ok) throw new Error(data.message || "Гирифтани рӯйхати муассисаҳо имкон нашуд.");
  return data.institutions ?? [];
}
