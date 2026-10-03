import { describe, expect, it } from "vitest";
import { SHARED_DB_OPT_IN, testDatabaseUrl } from "@/test/db-env";

describe("testDatabaseUrl", () => {
  it("prefers DATABASE_URL_TEST over everything", () => {
    expect(testDatabaseUrl({ DATABASE_URL: "prod", DATABASE_URL_TEST: "test" })).toBe("test");
    expect(testDatabaseUrl({ DATABASE_URL_TEST: "test", [SHARED_DB_OPT_IN]: "1" })).toBe("test");
  });

  it("uses DATABASE_URL only with the explicit opt-in", () => {
    expect(testDatabaseUrl({ DATABASE_URL: "prod" })).toBeUndefined();
    expect(testDatabaseUrl({ DATABASE_URL: "prod", [SHARED_DB_OPT_IN]: "true" })).toBeUndefined();
    expect(testDatabaseUrl({ DATABASE_URL: "prod", [SHARED_DB_OPT_IN]: "1" })).toBe("prod");
  });

  it("is undefined without any database", () => {
    expect(testDatabaseUrl({ [SHARED_DB_OPT_IN]: "1" })).toBeUndefined();
    expect(testDatabaseUrl({})).toBeUndefined();
  });
});
