import { createHash } from "node:crypto";
import { sql, type Transaction } from "kysely";
import { db } from "./db";
import type { DB } from "./schema";

export interface IdempotentResult<T> {
  status: number;
  body: T;
  replayed: boolean;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * Executes an API mutation once per authenticated user, scope and key.
 * The key claim, business mutation and stored response share one transaction.
 * Concurrent retries wait on the unique key and then replay the committed result.
 */
export async function runIdempotent<T>(
  scope: string,
  userId: number,
  key: string,
  payload: unknown,
  operation: (trx: Transaction<DB>) => Promise<{ status: number; body: T }>,
): Promise<IdempotentResult<T>> {
  if (!scope.trim() || !key.trim() || key.length > 200) {
    throw new Error("Калиди амалиёти такрорӣ нодуруст аст.");
  }

  const requestHash = createHash("sha256").update(stableJson(payload)).digest("hex");

  return db.transaction().execute(async trx => {
    await sql`
      INSERT INTO api_idempotency_keys
        (scope, user_id, idempotency_key, request_hash)
      VALUES
        (${scope}, ${userId}, ${key}, ${requestHash})
      ON CONFLICT (scope, user_id, idempotency_key) DO NOTHING
    `.execute(trx);

    const stored = await sql<Record<string, unknown>>`
      SELECT request_hash, response_status, response_body
      FROM api_idempotency_keys
      WHERE scope = ${scope}
        AND user_id = ${userId}
        AND idempotency_key = ${key}
      FOR UPDATE
    `.execute(trx);

    const existing = stored.rows[0];
    if (!existing) throw new Error("Сабти калиди амалиёт дастрас нест.");
    const getStoredColumn = (columnName: string) => {
      const normalized = columnName.replace(/_/g, "").toLowerCase();
      const keyName = Object.keys(existing).find((name) => name.replace(/_/g, "").toLowerCase() === normalized);
      return keyName === undefined ? undefined : existing[keyName];
    };
    const storedHash = getStoredColumn("request_hash");
    const responseStatus = getStoredColumn("response_status") as number | null | undefined;
    const storedResponseBody = getStoredColumn("response_body") as T | string | null | undefined;
    const responseBody = typeof storedResponseBody === "string"
      ? JSON.parse(storedResponseBody) as T
      : storedResponseBody as T | null | undefined;

    if (storedHash !== requestHash) {
      return {
        status: 409,
        body: { message: "Ин калиди амалиёт бо маълумоти дигар истифода шудааст." } as T,
        replayed: true,
      };
    }

    if (responseStatus !== null && responseStatus !== undefined) {
      return {
        status: responseStatus,
        body: responseBody as T,
        replayed: true,
      };
    }

    const result = await operation(trx);
    await sql`
      UPDATE api_idempotency_keys
      SET response_status = ${result.status},
          response_body = ${JSON.stringify(result.body)}::jsonb
      WHERE scope = ${scope}
        AND user_id = ${userId}
        AND idempotency_key = ${key}
    `.execute(trx);

    return { ...result, replayed: false };
  });
}
