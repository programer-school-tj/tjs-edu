import superjson from "superjson";
import { z } from "zod";
import { getInstitutions } from "../endpoints/institutions/create_POST.schema";

export const classInputSchema = z.object({ institutionId:z.string().uuid(), grade:z.number().int().min(1).max(11), section:z.string().trim().min(1).max(8), academicYear:z.string().regex(/^20[0-9]{2}-20[0-9]{2}$/), classTeacherStaffId:z.string().uuid().nullable().optional() });
export const studentInputSchema = z.object({ institutionId:z.string().uuid(), classId:z.string().uuid(), fullName:z.string().trim().min(3).max(180), birthDate:z.string().optional(), gender:z.enum(["male","female","other"]).optional(), studentNumber:z.string().optional(), guardianName:z.string().optional(), guardianPhone:z.string().optional() });
async function request<T>(url:string, init?:RequestInit):Promise<T>{const response=await fetch(url,{credentials:"include",...init});const data=superjson.parse<any>(await response.text());if(!response.ok)throw new Error(data.message||"Амалиёт иҷро нашуд.");return data as T;}
export { getInstitutions };
export async function getClasses(institutionId:string){return (await request<{classes:any[]}>(`/_api/classes/list?institutionId=${encodeURIComponent(institutionId)}`)).classes||[];}
export async function addClass(input:z.infer<typeof classInputSchema>){return request("/_api/classes/create",{method:"POST",headers:{"Content-Type":"application/json"},body:superjson.stringify(classInputSchema.parse(input))});}
export async function getStudents(institutionId:string,classId?:string){const q=new URLSearchParams({institutionId});if(classId)q.set("classId",classId);return (await request<{students:any[]}>(`/_api/students/list?${q}`)).students||[];}
export async function addStudent(input:z.infer<typeof studentInputSchema>){return request("/_api/students/create",{method:"POST",headers:{"Content-Type":"application/json"},body:superjson.stringify(studentInputSchema.parse(input))});}