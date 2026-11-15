const leadingBegin = /^(?:\uFEFF)?\s*(?:(?:--[^\r\n]*(?:\r?\n|$))|(?:\/\*[\s\S]*?\*\/\s*))*BEGIN\s*;\s*/i;
const trailingCommit = /\s*COMMIT\s*;\s*(?:(?:--[^\r\n]*(?:\r?\n|$))|(?:\/\*[\s\S]*?\*\/\s*))*$/i;

/**
 * Removes the optional outer transaction markers from a SQL migration.
 * The migration runner owns the transaction so the schema changes and the
 * migration-history row are committed or rolled back together.
 */
export function stripMigrationTransaction(source: string): string {
  const begin = source.match(leadingBegin);
  if (!begin) {
    throw new Error("SQL migration must start with BEGIN; after optional comments.");
  }

  const body = source.slice(begin[0].length);
  if (!trailingCommit.test(body)) {
    throw new Error("SQL migration must end with COMMIT; after optional comments.");
  }

  const statementBody = body.replace(trailingCommit, "").trim();
  if (!statementBody) {
    throw new Error("SQL migration has no statements.");
  }

  return statementBody;
}
