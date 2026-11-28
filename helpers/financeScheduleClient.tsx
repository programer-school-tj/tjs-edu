import superjson from "superjson";
import { enqueueOutbox, flushOutbox, listOutbox } from "./offlineOutbox";
import { cacheFormDocument, readCachedFormDocument } from "./formDocumentCache";
type QuotaResult = { operationCount: number; plan: "free" | "pro" };
async function call<T>(url:string,body?:unknown):Promise<T>{const r=await fetch(url,{credentials:"include",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:superjson.stringify(body)}:{})});const d=superjson.parse<any>(await r.text());if(!r.ok)throw new Error(d.message||"Амалиёт иҷро нашуд.");return d as T;}
export const getTariffs=async(institutionId:string)=>(await call<{tariffs:any[]}>(`/_api/tariffs/list?institutionId=${encodeURIComponent(institutionId)}`)).tariffs||[];
type FinanceMutationKind = "tariffs" | "payroll" | "timetable";
const financeMutationScope = (kind: FinanceMutationKind, userId: number) => `${kind}.create:${userId}`;
const financeMutationUrl: Record<FinanceMutationKind, string> = { tariffs: "/_api/tariffs/create", payroll: "/_api/payroll/create", timetable: "/_api/timetable/create" };
async function sendFinanceMutation<T>(kind: FinanceMutationKind, payload: unknown, operationId: string, userId: number): Promise<T> {
  const response = await fetch(financeMutationUrl[kind], { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "Idempotency-Key": operationId, "X-Expected-User-ID": String(userId) }, body: superjson.stringify(payload) });
  const data = superjson.parse<any>(await response.text());
  if (!response.ok) throw new Error(data.message || "Амалиёт иҷро нашуд.");
  return data as T;
}
export async function syncFinanceMutationOutbox(userId: number, kind: FinanceMutationKind) {
  const scope = financeMutationScope(kind, userId);
  return flushOutbox(async (operationId, entryScope, payload) => {
    if (entryScope !== scope) throw new Error("Навъи амалиёти офлайн дастгирӣ намешавад.");
    await sendFinanceMutation(kind, payload, operationId, userId);
  }, scope);
}
async function createFinanceRecord<T extends QuotaResult>(kind: FinanceMutationKind, payload: unknown, userId: number): Promise<T & { queued?: boolean }> {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("Ҳисоби корбар тасдиқ нашудааст.");
  const operationId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try { return await sendFinanceMutation<T>(kind, payload, operationId, userId); }
  catch (error) {
    const networkFailure = error instanceof TypeError || (typeof navigator !== "undefined" && navigator.onLine === false);
    if (!networkFailure) throw error;
    const scope = financeMutationScope(kind, userId);
    await enqueueOutbox(scope, payload, operationId);
    await syncFinanceMutationOutbox(userId, kind);
    const pending = await listOutbox(scope);
    if (pending.some((item) => item.id === operationId)) return { queued: true } as T & { queued: true };
    return sendFinanceMutation<T>(kind, payload, operationId, userId);
  }
}
export const addTariff=(x:any,userId:number)=>createFinanceRecord<QuotaResult & {tariff:any}>("tariffs",x,userId);
export const adjustTariffs=(x:{institutionId:string;academicYear:string;effectiveFrom:string;adjustmentPercent:number;positionTitle?:string;staffId?:string;sourceTitle:string;sourceReference?:string;notes?:string})=>call<QuotaResult & {changed:any[];changedCount:number}>("/_api/tariffs/adjust",x);
export const getPayroll=async(institutionId:string,month:string)=>(await call<{entries:any[]}>(`/_api/payroll/list?institutionId=${encodeURIComponent(institutionId)}&month=${month}`)).entries||[];
export const addPayroll=(x:any,userId:number)=>createFinanceRecord<QuotaResult & {entry:any}>("payroll",x,userId);
export const getTimetable=async(institutionId:string,academicYear:string)=>(await call<{entries:any[]}>(`/_api/timetable/list?institutionId=${encodeURIComponent(institutionId)}&academicYear=${academicYear}`)).entries||[];
export const addTimetable=(x:any,userId:number)=>createFinanceRecord<QuotaResult & {entry:any}>("timetable",x,userId);
export type FormDocumentType = "tariffing" | "payroll" | "timetable";
type FormDocumentInput = {institutionId:string;documentType:FormDocumentType;academicYear:string;periodKey?:string;templateVersion?:string;cells:Record<string,string>};
const formDocumentScope = (userId:number) => `forms.save:${userId}`;
async function sendFormDocument(x:FormDocumentInput, operationId:string, userId:number) {
  const response = await fetch("/_api/forms/save", {
    method:"POST", credentials:"include",
    headers:{"Content-Type":"application/json","Idempotency-Key":operationId,"X-Expected-User-ID":String(userId)},
    body:superjson.stringify(x),
  });
  const data = superjson.parse<any>(await response.text());
  if (!response.ok) throw new Error(data.message || "Сабти бланка иҷро нашуд.");
  return data;
}
export const getFormDocument=async(institutionId:string,documentType:FormDocumentType,academicYear:string,periodKey="",userId:number)=>{
  const key={userId,institutionId,documentType,academicYear,periodKey};
  try {
    const document=(await call<{document:any}>(`/_api/forms/load?institutionId=${encodeURIComponent(institutionId)}&documentType=${documentType}&academicYear=${encodeURIComponent(academicYear)}&periodKey=${encodeURIComponent(periodKey)}`)).document;
    if(document) await cacheFormDocument({...key,templateVersion:String(document.templateVersion||""),cells:(document.payload?.cells||{}) as Record<string,string>,updatedAt:Date.now()});
    return document;
  } catch(error) {
    const networkFailure=error instanceof TypeError||(typeof navigator!=="undefined"&&navigator.onLine===false);
    if(!networkFailure) throw error;
    const cached=await readCachedFormDocument(key);
    if(cached) return {templateVersion:cached.templateVersion,payload:{cells:cached.cells},updatedAt:cached.updatedAt};
    throw error;
  }
};
export async function syncFormDocumentOutbox(userId:number) {
  const scope=formDocumentScope(userId);
  return flushOutbox(async(operationId,entryScope,payload)=>{
    if(entryScope!==scope) throw new Error("Навъи амалиёти офлайн дастгирӣ намешавад.");
    await sendFormDocument(payload as FormDocumentInput,operationId,userId);
  },scope);
}
export const saveFormDocument=async(x:FormDocumentInput,userId:number)=>{
  const payload={...x,periodKey:x.periodKey||"",templateVersion:x.templateVersion||"2026-11-19-original-forms-v1"};
  await cacheFormDocument({userId,institutionId:payload.institutionId,documentType:payload.documentType,academicYear:payload.academicYear,periodKey:payload.periodKey,templateVersion:payload.templateVersion,cells:payload.cells,updatedAt:Date.now()});
  const operationId=typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():`form-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    await sendFormDocument(payload,operationId,userId);
    return {saved:true as const};
  } catch(error) {
    const networkFailure=error instanceof TypeError||(typeof navigator!=="undefined"&&navigator.onLine===false);
    if(!networkFailure) throw error;
    const entry=await enqueueOutbox(formDocumentScope(userId),payload);
    await syncFormDocumentOutbox(userId);
    const pending=await listOutbox(formDocumentScope(userId));
    return pending.some(item=>item.id===entry.id)?{saved:false as const,queued:true as const}:{saved:true as const};
  }
}

export const getTeachingLoads=async(institutionId:string,academicYear:string)=>(await call<{loads:any[]}>(`/_api/teaching-loads/list?institutionId=${encodeURIComponent(institutionId)}&academicYear=${encodeURIComponent(academicYear)}`)).loads||[];
export const addTeachingLoad=(x:any)=>call<{load:any}>("/_api/teaching-loads/create",x);
export const generateTimetable=(x:{institutionId:string;academicYear:string})=>call<{created:number;operationCount:number;plan:"free"|"pro"}>("/_api/timetable/generate",x);

export const importTimetableRows=(x:{institutionId:string;academicYear:string;rows:Array<{grade:number;section:string;weekday:number;lessonNumber:number;subject:string;teacherName:string;room?:string}>})=>call<{imported:number;operationCount:number;plan:"free"|"pro"}>("/_api/timetable/import",x);

export type TimetableSettings = {
  schoolDays: number;
  maxLessonsPerDay: number;
  teacherDailyLimit: number;
  classDailyLimit: number;
  shiftSplitGrade: number;
  teacherDailyLimits: Record<string, number>;
  classDailyLimits: Record<string, number>;
};
export const getTimetableSettings=async(institutionId:string,academicYear:string)=>(await call<{settings:TimetableSettings}>(`/_api/timetable-settings/list?institutionId=${encodeURIComponent(institutionId)}&academicYear=${encodeURIComponent(academicYear)}`)).settings;
const timetableSettingsScope = (userId: number) => `timetable.settings.save:${userId}`;
async function sendTimetableSettings(payload: {institutionId:string;academicYear:string}&TimetableSettings, userId:number) {
  const response = await fetch("/_api/timetable-settings/save", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-Expected-User-ID": String(userId) },
    body: superjson.stringify(payload),
  });
  const data = superjson.parse<any>(await response.text());
  if (!response.ok) throw new Error(data.message || "Танзимоти ҷадвал сабт нашуд.");
}
export async function syncTimetableSettingsOutbox(userId: number) {
  const scope = timetableSettingsScope(userId);
  return flushOutbox(async (_operationId, entryScope, payload) => {
    if (entryScope !== scope) throw new Error("Навъи амалиёти офлайн дастгирӣ намешавад.");
    await sendTimetableSettings(payload as {institutionId:string;academicYear:string}&TimetableSettings,userId);
  }, scope);
}
export const saveTimetableSettings=async(x:{institutionId:string;academicYear:string}&TimetableSettings, userId: number)=>{
  try {
    await sendTimetableSettings(x,userId);
    return { saved: true as const };
  } catch (error) {
    const networkFailure = error instanceof TypeError || (typeof navigator !== "undefined" && navigator.onLine === false);
    if (!networkFailure) throw error;
    const scope = timetableSettingsScope(userId);
    const entry = await enqueueOutbox(scope, x);
    await syncTimetableSettingsOutbox(userId);
    const pending = await listOutbox(scope);
    return pending.some((item) => item.id === entry.id)
      ? { saved: false as const, queued: true as const }
      : { saved: true as const };
  }
};

export const getStaffAvailability=async(institutionId:string,academicYear:string)=>(await call<{slots:any[]}>(`/_api/staff-availability/list?institutionId=${encodeURIComponent(institutionId)}&academicYear=${encodeURIComponent(academicYear)}`)).slots||[];
export const saveStaffAvailability=(x:{institutionId:string;staffId:string;academicYear:string;slots:Array<{weekday:number;shiftNumber?:number;lessonNumber:number}>})=>call<{saved:number}>("/_api/staff-availability/save",x);

export const previewPayroll = (x: any) => call<{ preview: any }>("/_api/payroll/preview", x);
