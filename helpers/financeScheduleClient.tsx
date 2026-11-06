import superjson from "superjson";
type QuotaResult = { operationCount: number; plan: "free" | "pro" };
async function call<T>(url:string,body?:unknown):Promise<T>{const r=await fetch(url,{credentials:"include",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:superjson.stringify(body)}:{})});const d=superjson.parse<any>(await r.text());if(!r.ok)throw new Error(d.message||"Амалиёт иҷро нашуд.");return d as T;}
export const getTariffs=async(institutionId:string)=>(await call<{tariffs:any[]}>(`/_api/tariffs/list?institutionId=${encodeURIComponent(institutionId)}`)).tariffs||[];
export const addTariff=(x:any)=>call<QuotaResult & {tariff:any}>("/_api/tariffs/create",x);
export const getPayroll=async(institutionId:string,month:string)=>(await call<{entries:any[]}>(`/_api/payroll/list?institutionId=${encodeURIComponent(institutionId)}&month=${month}`)).entries||[];
export const addPayroll=(x:any)=>call<QuotaResult & {entry:any}>("/_api/payroll/create",x);
export const getTimetable=async(institutionId:string,academicYear:string)=>(await call<{entries:any[]}>(`/_api/timetable/list?institutionId=${encodeURIComponent(institutionId)}&academicYear=${academicYear}`)).entries||[];
export const addTimetable=(x:any)=>call<QuotaResult & {entry:any}>("/_api/timetable/create",x);
export type FormDocumentType = "tariffing" | "payroll" | "timetable";
export const getFormDocument=async(institutionId:string,documentType:FormDocumentType,academicYear:string,periodKey="")=>(await call<{document:any}>(`/_api/forms/load?institutionId=${encodeURIComponent(institutionId)}&documentType=${documentType}&academicYear=${encodeURIComponent(academicYear)}&periodKey=${encodeURIComponent(periodKey)}`)).document;
export const saveFormDocument=(x:{institutionId:string;documentType:FormDocumentType;academicYear:string;periodKey?:string;templateVersion?:string;cells:Record<string,string>})=>call<{document:any}>("/_api/forms/save",x);