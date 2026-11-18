import { describe, expect, it } from "vitest";
import { normalizePhoneE164 } from "@/features/auth/phone-number";

describe("normalizePhoneE164", () => {
  it("keeps a valid international number and removes display separators", () => {
    expect(normalizePhoneE164(" +52 (81) 2345-6789 ")).toBe("+528123456789");
  });

  it("assumes Mexico for a 10-digit national number", () => {
    expect(normalizePhoneE164("81 1234 5678")).toBe("+528112345678");
  });

  it("accepts a Mexican number with the country code", () => {
    expect(normalizePhoneE164("+52 81 1234 5678")).toBe("+528112345678");
  });

  it.each(["123456789", "81 1234 567", "+521234", "+02012345678", "+52abc1234567", "+1234567890123456"])(
    "rejects an invalid E.164 number: %s",
    (phone) => expect(normalizePhoneE164(phone)).toBeNull(),
  );
});
