import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/features/auth/next-path";

describe("safeNextPath", () => {
  it("keeps same-site paths with their query", () => {
    expect(safeNextPath("/prendas/top?x=1")).toBe("/prendas/top?x=1");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeNextPath("https://evil.example")).toBeUndefined();
    expect(safeNextPath("//evil.example")).toBeUndefined();
    expect(safeNextPath("/\\evil.example")).toBeUndefined();
    expect(safeNextPath(undefined)).toBeUndefined();
  });
});
