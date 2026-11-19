export function normalizePhoneE164(value: string) {
  const compact = value.trim().replace(/[\s()-]/g, "");
  const normalized = /^\d{10}$/.test(compact) ? `+52${compact}` : compact;
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

// The login field shows "+52" as a fixed prefix and keeps only the 10 national digits, so a
// shopper can't mistype the country code. A pasted "+52 81 2345 6789" (or "52…") still works:
// a leading 52 on a 12-digit value is the country code, not part of the number.
export function nationalDigitsMX(value: string) {
  const digits = value.replace(/\D/g, "");
  const national = digits.length > 10 && digits.startsWith("52") ? digits.slice(2) : digits;
  return national.slice(0, 10);
}

export function formatNationalMX(digits: string) {
  return [digits.slice(0, 2), digits.slice(2, 6), digits.slice(6, 10)].filter(Boolean).join(" ");
}
