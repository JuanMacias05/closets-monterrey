import { categoryLabel } from "@/features/products/section-categories";
import type { CatalogProduct } from "@/features/products/types";

// Query rules for the store search. They mirror private.search_tokens / search_tsquery in
// supabase/migrations/20261122000100_store_search.sql, which does the real matching; this copy
// serves the demo catalog (local e2e) and lets the UI tell a searchable query from noise
// without a round trip. Change both together.

export const MAX_SEARCH_QUERY_LENGTH = 80;
export const LIVE_RESULTS_LIMIT = 6;
export const POPULAR_TERMS_COUNT = 5;
// Shown while the store has too little search history to have real favorites.
export const CURATED_SEARCH_TERMS = ["Sudadera", "Vestido", "Pantalón", "Tenis", "Blusa"] as const;

const MAX_TOKENS = 6;
const MAX_TOKEN_LENGTH = 30;
const SIZE_TOKENS = new Set(["xs", "s", "m", "l", "xl", "xxl"]);
const SHORT_SIZE_TOKENS = new Set(["xs", "s", "m", "l", "xl"]);
const FILLER_WORDS = new Set(["de", "del", "la", "las", "el", "los", "y", "o", "a", "al", "en", "con", "sin", "para", "por", "un", "una", "talla"]);

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dropPlural(word: string): string {
  if (word.length > 5 && /[^aeiou]es$/.test(word)) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

export function searchTokens(query: string): string[] {
  const tokens: string[] = [];
  for (const word of normalizeSearchText(query.slice(0, 200)).split(" ")) {
    if (!word || FILLER_WORDS.has(word)) continue;
    if (word.length <= 2 && !/^[0-9]+$/.test(word) && !SHORT_SIZE_TOKENS.has(word)) continue;
    const token = dropPlural(word).slice(0, MAX_TOKEN_LENGTH);
    if (!tokens.includes(token)) tokens.push(token);
    if (tokens.length === MAX_TOKENS) break;
  }
  return tokens;
}

function isWholeWordToken(token: string) {
  return /^[0-9]+$/.test(token) || SIZE_TOKENS.has(token);
}

// The `q` search param as typed, tidied: undefined when there's nothing to search for.
export function parseSearchQuery(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const query = value.replace(/\s+/g, " ").trim().slice(0, MAX_SEARCH_QUERY_LENGTH).trim();
  return searchTokens(query).length > 0 ? query : undefined;
}

// Live results start once there is a real token: three letters ("ves"), a size or a number.
// One or two letters would match half the catalog and make the list flicker while typing.
export function isLiveSearchable(query: string): boolean {
  return searchTokens(query).length > 0;
}

function productSearchWords(product: CatalogProduct): string[] {
  // Every wording of its category matches ("blusa" and "playera" both find a top), labelled by audience elsewhere.
  const labels = [categoryLabel(product.category, product.audience), categoryLabel(product.category, "women"), categoryLabel(product.category, "unisex")];
  return normalizeSearchText([product.name, product.size, ...labels, product.description].join(" ")).split(" ");
}

export function productMatchesSearch(product: CatalogProduct, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  const words = productSearchWords(product);
  return tokens.every((token) => isWholeWordToken(token)
    ? words.includes(token)
    : words.some((word) => word.startsWith(token)));
}

export function displaySearchTerm(term: string): string {
  const tidy = term.replace(/\s+/g, " ").trim();
  return tidy.charAt(0).toLocaleUpperCase("es-MX") + tidy.slice(1);
}

// Two terms that search the same thing ("vestidos", "Vestido") are one chip.
function termKey(term: string) {
  return searchTokens(term).join(" ") || normalizeSearchText(term);
}

// Real popular terms first, then the curated list to fill the row. The database stores terms
// without accents, so a popular "pantalon" borrows the curated spelling "Pantalón" and the
// same search never shows twice.
export function mergePopularTerms(popular: string[], count = POPULAR_TERMS_COUNT, fallback: readonly string[] = CURATED_SEARCH_TERMS): string[] {
  const spelled = new Map(fallback.map((term) => [termKey(term), term]));
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const term of [...popular, ...fallback]) {
    const key = termKey(term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(displaySearchTerm(spelled.get(key) ?? term));
    if (merged.length === count) break;
  }
  return merged;
}

export function searchResultsHref(query: string): string {
  return `/?${new URLSearchParams({ q: query.replace(/\s+/g, " ").trim().slice(0, MAX_SEARCH_QUERY_LENGTH) })}`;
}
