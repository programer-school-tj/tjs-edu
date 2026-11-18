BEGIN;
-- Request-level idempotency for safe retries from the offline outbox.
CREATE TABLE IF NOT EXISTS api_idempotency_keys (
  scope TEXT NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  PRIMARY KEY (scope, user_id, idempotency_key),
  CHECK (response_status IS NULL OR response_status BETWEEN 200 AND 599)
);
CREATE INDEX IF NOT EXISTS api_idempotency_expiry_idx
  ON api_idempotency_keys(expires_at);
COMMENT ON TABLE api_idempotency_keys IS
  'Stores completed API responses for safe client retries; rows expire after seven days.';
COMMIT;
