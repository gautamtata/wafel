import { config } from "dotenv";
import { DB_TESTS_SKIPPED_MESSAGE, testDatabaseUrl } from "./db-env";

export default function announceDatabase(): void {
  config({ path: [".env.local", ".env"], quiet: true });
  if (!testDatabaseUrl()) console.warn(DB_TESTS_SKIPPED_MESSAGE);
}
