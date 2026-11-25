import { normalizePhoneE164 } from "@/features/auth/phone-number";

// "+ Agregar persona" (admins): the checks the form and the server action share. Pure, for tests.

export type AddPersonInput = { phone: string; fullName: string; storeName: string; sell: boolean; deliver: boolean; administer: boolean };

export type ParsedPerson = { phoneE164: string; fullName: string; storeName: string | null; sell: boolean; deliver: boolean; administer: boolean };

export function parseAddPerson(input: AddPersonInput): { ok: true; person: ParsedPerson } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Datos no válidos." };
  const digits = typeof input.phone === "string" ? input.phone.replace(/\D/g, "") : "";
  const phoneE164 = digits.length === 10 ? normalizePhoneE164(digits) : null;
  if (!phoneE164) return { ok: false, error: "Escribe los 10 dígitos de su celular." };
  const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
  if (fullName.length < 2 || fullName.length > 80) return { ok: false, error: "Escribe su nombre (2 a 80 caracteres)." };
  const sell = input.sell === true;
  const deliver = input.deliver === true;
  const administer = input.administer === true;
  if (!sell && !deliver && !administer) return { ok: false, error: "Marca al menos una actividad: vender, entregar o administrar." };
  const storeName = typeof input.storeName === "string" ? input.storeName.trim() : "";
  if (sell && storeName.length > 60) return { ok: false, error: "El nombre de su tienda es demasiado largo (máximo 60)." };
  return { ok: true, person: { phoneE164, fullName, storeName: sell ? storeName || null : null, sell, deliver, administer } };
}

// "Cómo llegó" in the admin lists: added_by is null when she signed up herself.
export function arrivalLabel(addedBy: string | null | undefined): string {
  return addedBy ? "Registro: lo hizo un admin" : "Registro: por su cuenta";
}
