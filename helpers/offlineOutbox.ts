export type OutboxStatus = "queued" | "syncing" | "failed";

export interface OutboxEntry<T = unknown> {
  id: string;
  scope: string;
  payload: T;
  status: OutboxStatus;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  lastError?: string;
  retryable?: boolean;
}

const DATABASE_NAME = "tjs-edu-offline";
const DATABASE_VERSION = 1;
const STORE_NAME = "outbox";

function openOutboxDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB дар ин муҳит дастрас нест."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("by_created_at", "createdAt", { unique: false });
        store.createIndex("by_scope", "scope", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Кушодани IndexedDB ноком шуд."));
    request.onblocked = () => reject(new Error("Навсозии IndexedDB баста шудааст. Ҷадвалҳои кӯҳнаро нав кунед."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Амалиёти IndexedDB ноком шуд."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("Амалиёти IndexedDB бекор шуд."));
    transaction.onerror = () => reject(transaction.error ?? new Error("Хатои IndexedDB."));
  });
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `outbox-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Adds a durable local operation. Keep the returned id as the server idempotency key. */
export async function enqueueOutbox<T>(scope: string, payload: T, operationId = createId()): Promise<OutboxEntry<T>> {
  if (!scope.trim()) throw new Error("Scope-и амалиёт холӣ буда наметавонад.");
  const now = Date.now();
  const entry: OutboxEntry<T> = {
    id: operationId,
    scope,
    payload,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    attempts: 0,
  };
  const database = await openOutboxDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).add(entry);
    await transactionDone(transaction);
    return entry;
  } finally {
    database.close();
  }
}

export async function listOutbox<T = unknown>(scope?: string): Promise<OutboxEntry<T>[]> {
  const database = await openOutboxDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const entries = scope
      ? await requestResult<OutboxEntry<T>[]>(store.index("by_scope").getAll(scope))
      : await requestResult<OutboxEntry<T>[]>(store.getAll());
    await transactionDone(transaction);
    return entries.sort((a, b) => a.createdAt - b.createdAt);
  } finally {
    database.close();
  }
}

export async function removeOutboxEntry(id: string): Promise<void> {
  const database = await openOutboxDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export interface OutboxFlushResult {
  sent: number;
  failed: number;
}

/**
 * Sends pending operations in creation order. The stable entry id is passed to
 * the sender so the API can enforce idempotency and safely accept retries.
 */
export async function flushOutbox(
  send: (operationId: string, scope: string, payload: unknown) => Promise<void>,
  scope?: string,
): Promise<OutboxFlushResult> {
  const entries = await listOutbox(scope);
  let sent = 0;
  let failed = 0;

  for (const entry of entries) {
    // Claim atomically so two tabs do not send the same operation at once.
    // A two-minute lease allows recovery if the previous page was closed mid-send.
    const claimed = await claimEntry(entry.id);
    if (!claimed) continue;
    try {
      await send(entry.id, entry.scope, entry.payload);
      await removeOutboxEntry(entry.id);
      sent += 1;
    } catch (error) {
      await updateEntry(entry.id, {
        status: "failed",
        attempts: entry.attempts + 1,
        lastError: error instanceof Error ? error.message : "Хатои номаълум",
        updatedAt: Date.now(),
      });
      failed += 1;
    }
  }
  return { sent, failed };
}

async function claimEntry(id: string): Promise<boolean> {
  const database = await openOutboxDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const current = await requestResult<OutboxEntry | undefined>(store.get(id));
    if (!current) {
      await transactionDone(transaction);
      return false;
    }

    const leaseExpired = Date.now() - current.updatedAt > 2 * 60 * 1000;
    if (current.status === "failed" && current.retryable === false) {
      await transactionDone(transaction);
      return false;
    }

    if (current.status === "syncing" && !leaseExpired) {
      await transactionDone(transaction);
      return false;
    }

    store.put({ ...current, status: "syncing", updatedAt: Date.now() });
    await transactionDone(transaction);
    return true;
  } finally {
    database.close();
  }
}

async function updateEntry(id: string, changes: Partial<OutboxEntry>): Promise<void> {
  const database = await openOutboxDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const current = await requestResult<OutboxEntry | undefined>(store.get(id));
    if (current) store.put({ ...current, ...changes });
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}
