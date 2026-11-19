type AttendanceCacheEntry<T> = {
  key: string;
  userId: number;
  institutionId: string;
  classId: string;
  date: string;
  savedAt: number;
  value: T;
};

const DATABASE_NAME = "tjs-edu-attendance-cache";
const STORE_NAME = "rosters";
const DATABASE_VERSION = 1;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB дар ин муҳит дастрас нест."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Кушодани кэши давомот ноком шуд."));
    request.onblocked = () => reject(new Error("Кэши давомот баста шудааст."));
  });
}

function cacheKey(userId: number, institutionId: string, classId: string, date: string) {
  return [userId, institutionId, classId, date].join(":");
}

export async function saveAttendanceRosterCache<T>(
  userId: number,
  institutionId: string,
  classId: string,
  date: string,
  value: T,
): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({
      key: cacheKey(userId, institutionId, classId, date),
      userId,
      institutionId,
      classId,
      date,
      savedAt: Date.now(),
      value,
    } satisfies AttendanceCacheEntry<T>);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Сабти кэши давомот ноком шуд."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Сабти кэши давомот бекор шуд."));
    });
  } finally {
    database.close();
  }
}

export async function getAttendanceRosterCache<T>(
  userId: number,
  institutionId: string,
  classId: string,
  date: string,
): Promise<{ value: T; savedAt: number } | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(cacheKey(userId, institutionId, classId, date));
    const entry = await new Promise<AttendanceCacheEntry<T> | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Хондани кэши давомот ноком шуд."));
    });
    if (!entry) return null;
    if (Date.now() - entry.savedAt > CACHE_TTL_MS) {
      const cleanup = database.transaction(STORE_NAME, "readwrite");
      cleanup.objectStore(STORE_NAME).delete(entry.key);
      await new Promise<void>((resolve, reject) => {
        cleanup.oncomplete = () => resolve();
        cleanup.onerror = () => reject(cleanup.error ?? new Error("Тозакунии кэш ноком шуд."));
        cleanup.onabort = () => reject(cleanup.error ?? new Error("Тозакунии кэш бекор шуд."));
      });
      return null;
    }
    return { value: entry.value, savedAt: entry.savedAt };
  } finally {
    database.close();
  }
}
