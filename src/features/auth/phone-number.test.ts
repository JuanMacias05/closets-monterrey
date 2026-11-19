import { describe, expect, it } from "vitest";
import { formatNationalMX, nationalDigitsMX, normalizePhoneE164 } from "@/features/auth/phone-number";

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

describe("nationalDigitsMX", () => {
  it.each([
    ["8123456789", "8123456789"],
    ["81 2345 6789", "8123456789"],
    ["+52 81 2345 6789", "8123456789"],
    ["528123456789", "8123456789"],
    ["81234567890000", "8123456789"],
    ["81-23", "8123"],
  ])("keeps the national digits of %s", (input, expected) => expect(nationalDigitsMX(input)).toBe(expected));
});

describe("formatNationalMX", () => {
  it.each([
    ["", ""],
    ["81", "81"],
    ["8123", "81 23"],
    ["8123456789", "81 2345 6789"],
  ])("formats %s as %s", (input, expected) => expect(formatNationalMX(input)).toBe(expected));
});
