export const SHARED_DB_OPT_IN = "WAFEL_ALLOW_SHARED_DB_TESTS";

export const DB_TESTS_SKIPPED_MESSAGE =
  "DB-backed tests skipped: set DATABASE_URL_TEST to a dedicated test database, " +
  `or ${SHARED_DB_OPT_IN}=1 to run them against DATABASE_URL (which is the production database when pulled from Vercel).`;

/** The database the test suite may write to, or undefined when none is explicitly allowed. */
export function testDatabaseUrl(env: Record<string, string | undefined> = process.env): string | undefined {
  if (env.DATABASE_URL_TEST) return env.DATABASE_URL_TEST;
  if (env.DATABASE_URL && env[SHARED_DB_OPT_IN] === "1") return env.DATABASE_URL;
  return undefined;
}
