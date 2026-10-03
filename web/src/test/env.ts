import { config } from "dotenv";
import { testDatabaseUrl } from "./db-env";

config({ path: [".env.local", ".env"], quiet: true });

// Point Prisma at the database tests are allowed to write to; with none allowed, remove
// DATABASE_URL entirely so nothing can reach the shared database by accident.
const url = testDatabaseUrl();
if (url) process.env.DATABASE_URL = url;
else delete process.env.DATABASE_URL;
