// Buyers paste their Facebook profile link so sellers can check who they are — the way
// reservations already work in Monterrey resale groups. The database enforces the same
// shape (buyer_facebook_url_format); these helpers give a friendly error first.

export function normalizeFacebookUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withScheme.replace(/^http:\/\//i, "https://");
}

export function isValidFacebookUrl(value: string): boolean {
  return /^https:\/\/([a-z0-9-]+\.)?(facebook\.com|fb\.com|fb\.me)\/.+/i.test(value);
}
