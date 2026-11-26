import type { FormDocumentType } from "./financeScheduleClient";

export type CachedFormDocument = {
  userId: number;
  institutionId: string;
  documentType: FormDocumentType;
  academicYear: string;
  periodKey: string;
  templateVersion: string;
  cells: Record<string, string>;
  updatedAt: number;
};

const DB_NAME = "tjs-edu-form-documents";
const STORE_NAME = "documents";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Захираи офлайнӣ дар ин муҳит дастрас нест."));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Кушодани захираи бланкҳо ноком шуд."));
  });
}

function makeKey(value: Omit<CachedFormDocument, "cells" | "updatedAt">): string {
  return [value.userId, value.institutionId, value.documentType, value.academicYear, value.periodKey].join("|");
}

export async function cacheFormDocument(value: CachedFormDocument): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ ...value, key: makeKey(value) });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Нигоҳдории маҳаллии бланк ноком шуд."));
      tx.onabort = () => reject(tx.error || new Error("Нигоҳдории маҳаллии бланк бекор шуд."));
    });
  } finally {
    db.close();
  }
}

export async function readCachedFormDocument(
  value: Omit<CachedFormDocument, "cells" | "updatedAt" | "templateVersion">,
): Promise<CachedFormDocument | null> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(makeKey({ ...value, templateVersion: "" }));
      request.onsuccess = () => resolve(request.result ? request.result as CachedFormDocument : null);
      request.onerror = () => reject(request.error || new Error("Хондани бланки маҳаллӣ ноком шуд."));
    });
  } finally {
    db.close();
  }
}
