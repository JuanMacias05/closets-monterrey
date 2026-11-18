// Only same-site paths may be used as a post-login destination; anything else (an absolute
// URL, a protocol-relative "//host") would turn the login page into an open redirect.
export function safeNextPath(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\")) return undefined;
  return candidate;
}
