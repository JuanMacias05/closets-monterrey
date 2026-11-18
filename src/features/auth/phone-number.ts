export function normalizePhoneE164(value: string) {
  const compact = value.trim().replace(/[\s()-]/g, "");
  const normalized = /^\d{10}$/.test(compact) ? `+52${compact}` : compact;
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}
