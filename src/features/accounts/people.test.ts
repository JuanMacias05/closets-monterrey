import { describe, expect, it } from "vitest";
import { arrivalLabel, parseAddPerson } from "@/features/accounts/people";

const base = { phone: "81 0000 0012", fullName: " Sofía Garza ", storeName: "", sell: true, deliver: false, administer: false };

describe("parseAddPerson", () => {
  it("normalizes a 10-digit Mexican phone and trims the name", () => {
    expect(parseAddPerson(base)).toEqual({ ok: true, person: { phoneE164: "+528100000012", fullName: "Sofía Garza", storeName: null, sell: true, deliver: false, administer: false } });
  });

  it("keeps a store name only when she will sell", () => {
    expect(parseAddPerson({ ...base, storeName: " Clóset de Sofía " })).toMatchObject({ ok: true, person: { storeName: "Clóset de Sofía" } });
    expect(parseAddPerson({ ...base, sell: false, deliver: true, storeName: "Ignorado" })).toMatchObject({ ok: true, person: { storeName: null } });
  });

  it("refuses a short phone, a missing name or no activity", () => {
    expect(parseAddPerson({ ...base, phone: "81 0000" })).toMatchObject({ ok: false });
    expect(parseAddPerson({ ...base, fullName: "A" })).toMatchObject({ ok: false });
    expect(parseAddPerson({ ...base, sell: false })).toEqual({ ok: false, error: "Marca al menos una actividad: vender, entregar o administrar." });
  });
});

describe("arrivalLabel", () => {
  it("tells whether she signed up herself or an admin added her", () => {
    expect(arrivalLabel(null)).toBe("Se registró sola");
    expect(arrivalLabel("10000000-0000-4000-8000-000000000004")).toBe("Agregada por admin");
  });
});
