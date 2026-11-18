BEGIN;
-- Stores completed API operations so offline retries cannot apply them twice.
CREATE TABLE IF NOT EXISTS api_idempotency_keys (
  idempotency_key TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_body JSONB,
  response_status INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT api_idempotency_response_pair CHECK (
    (response_body IS NULL AND response_status IS NULL AND completed_at IS NULL)
    OR
    (response_body IS NOT NULL AND response_status BETWEEN 200 AND 299 AND completed_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS api_idempotency_created_at_idx
  ON api_idempotency_keys(created_at);
COMMIT;
