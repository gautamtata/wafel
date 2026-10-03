import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";

describe("db", () => {
  it("exposes a PrismaClient singleton without connecting", () => {
    expect(db).toBeDefined();
    expect(typeof db.$connect).toBe("function");
  });
});
