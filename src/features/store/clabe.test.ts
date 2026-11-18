import { describe, expect, it } from "vitest";
import { buildStoreAvatarStoragePath, isValidClabe } from "@/features/store/clabe";

describe("isValidClabe", () => {
  it("accepts an 18-digit CLABE with a valid check digit", () => {
    expect(isValidClabe("000000000000000000")).toBe(true);
  });

  it("rejects a CLABE with an invalid check digit", () => {
    expect(isValidClabe("000000000000000001")).toBe(false);
  });

  it.each(["", "00000000000000000", "00000000000000000a", "0000000000000000000"])(
    "rejects invalid CLABE shape: %s",
    (value) => expect(isValidClabe(value)).toBe(false),
  );
});

describe("buildStoreAvatarStoragePath", () => {
  it("uses the seller avatar folder and an opaque JPEG filename", () => {
    expect(buildStoreAvatarStoragePath("seller-id", "avatar-id")).toBe("sellers/seller-id/avatar/avatar-id.jpg");
  });
});
