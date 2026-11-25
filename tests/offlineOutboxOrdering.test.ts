import assert from "node:assert/strict";
import test from "node:test";
import { processOutboxInOrder, type OutboxEntry } from "../helpers/offlineOutbox";

function entry(id: string): Pick<OutboxEntry, "id" | "scope" | "payload"> {
  return { id, scope: "test", payload: { id } };
}

test("offline outbox stops after the first failed operation", async () => {
  const sent: string[] = [];
  const result = await processOutboxInOrder(
    [entry("first"), entry("second"), entry("third")],
    async item => {
      sent.push(item.id);
      if (item.id === "second") throw new Error("temporary network failure");
      return true;
    },
  );

  assert.deepEqual(sent, ["first", "second"]);
  assert.deepEqual(result, { sent: 1, failed: 1 });
});

test("offline outbox does not overtake an operation claimed by another tab", async () => {
  const sent: string[] = [];
  const result = await processOutboxInOrder(
    [entry("first"), entry("second")],
    async item => {
      sent.push(item.id);
      return false;
    },
  );

  assert.deepEqual(sent, ["first"]);
  assert.deepEqual(result, { sent: 0, failed: 0 });
});

test("offline outbox sends successful operations sequentially", async () => {
  const sent: string[] = [];
  const result = await processOutboxInOrder(
    [entry("first"), entry("second"), entry("third")],
    async item => {
      sent.push(item.id);
      return true;
    },
  );

  assert.deepEqual(sent, ["first", "second", "third"]);
  assert.deepEqual(result, { sent: 3, failed: 0 });
});
