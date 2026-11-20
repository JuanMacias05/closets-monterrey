import { describe, expect, it } from "vitest";
import { cleanCardNumber, formatCardNumber, isValidCardNumber } from "@/features/store/card-number";

describe("isValidCardNumber", () => {
  it("accepts 16 digits with a valid check digit", () => {
    expect(isValidCardNumber("4111111111111111")).toBe(true);
    expect(isValidCardNumber("5555555555554444")).toBe(true);
  });

  it("rejects a wrong check digit, wrong length or letters", () => {
    expect(isValidCardNumber("4111111111111112")).toBe(false);
    expect(isValidCardNumber("411111111111111")).toBe(false);
    expect(isValidCardNumber("4111 1111 1111 1111")).toBe(false);
  });
});

describe("formatting", () => {
  it("groups digits by four and strips everything else", () => {
    expect(cleanCardNumber("4111 1111-1111 1111")).toBe("4111111111111111");
    expect(formatCardNumber("4111111111111111")).toBe("4111 1111 1111 1111");
  });
});
