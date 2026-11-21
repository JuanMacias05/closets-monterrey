import { describe, expect, it } from "vitest";
import { feeRange, feesFromOrigin, isKnownMunicipality, parseDeliveryFeePesos } from "@/features/delivery/zone-rates";

const rates = [
  { origin_municipality: "Monterrey", destination_municipality: "Monterrey", fee_mxn: 6000 },
  { origin_municipality: "Monterrey", destination_municipality: "Apodaca", fee_mxn: 9000 },
  { origin_municipality: "Apodaca", destination_municipality: "Monterrey", fee_mxn: 11000 },
];

describe("feesFromOrigin", () => {
  it("keys one origin's fees by the buyer's municipality", () => {
    expect(feesFromOrigin(rates, "Monterrey")).toEqual({ Monterrey: 6000, Apodaca: 9000 });
  });

  it("leaves out destinations without a rate instead of inventing one", () => {
    expect(feesFromOrigin(rates, "Apodaca")).toEqual({ Monterrey: 11000 });
    expect(feesFromOrigin(rates, "García")).toEqual({});
  });
});

describe("feeRange", () => {
  it("is the cheapest and the dearest destination", () => {
    expect(feeRange({ Monterrey: 6000, Apodaca: 9000 })).toEqual({ min: 6000, max: 9000 });
  });

  it("is null when there is nothing to price from", () => {
    expect(feeRange({})).toBeNull();
  });
});

describe("isKnownMunicipality", () => {
  it.each([["Monterrey", true], ["San Nicolás de los Garza", true], ["Saltillo", false], ["", false], [null, false]])("%s → %s", (value, known) => {
    expect(isKnownMunicipality(value)).toBe(known);
  });
});

describe("parseDeliveryFeePesos", () => {
  it.each([["90", 9000], [" 120 ", 12000], ["$1,000", 100000], ["0", 0], ["75.00", 7500]])("reads %s as %i cents", (input, cents) => {
    expect(parseDeliveryFeePesos(input)).toEqual({ ok: true, cents });
  });

  it.each(["", "-10", "90.50", "abc", "1001"])("refuses %s", (input) => {
    expect(parseDeliveryFeePesos(input).ok).toBe(false);
  });
});
