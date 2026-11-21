import "server-only";

import { getCatalogPage } from "@/features/products/catalog-data";
import { formatPriceMXN } from "@/features/products/format-price";
import type { ProductSaleStatus } from "@/features/products/types";
import { LIVE_RESULTS_LIMIT, mergePopularTerms, parseSearchQuery, POPULAR_TERMS_COUNT } from "@/features/search/search-query";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LiveSearchResult = {
  id: string;
  slug: string;
  name: string;
  storeName: string;
  size: string;
  price: string;
  saleStatus: ProductSaleStatus;
  image: { url: string; alt: string } | null;
};

export type LiveSearchResponse = { query: string; results: LiveSearchResult[]; total: number; error: boolean };

// The header's live results are the first rows of the same catalog query the results page
// runs, so the list can't disagree with "Ver todo".
export async function getLiveSearchResults(rawQuery: string): Promise<LiveSearchResponse> {
  const query = parseSearchQuery(rawQuery);
  if (!query) return { query: rawQuery, results: [], total: 0, error: false };

  const page = await getCatalogPage({ q: query, hideSold: false, sort: "recent", page: 1 }, LIVE_RESULTS_LIMIT);
  return {
    query: rawQuery,
    total: page.total,
    error: page.error !== null,
    results: page.products.map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      storeName: product.seller.store_name,
      size: product.size,
      price: formatPriceMXN(product.price_mxn),
      saleStatus: product.sale_status,
      image: product.images[0] ? { url: product.images[0].url, alt: product.images[0].alt_text || product.name } : null,
    })),
  };
}

export async function getPopularSearchTerms(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return mergePopularTerms([]);
  const { data, error } = await supabase.rpc("popular_search_terms", { max_terms: POPULAR_TERMS_COUNT });
  if (error || !Array.isArray(data)) return mergePopularTerms([]);
  return mergePopularTerms((data as { term: string }[]).map((row) => row.term));
}

// Best effort: a lost count only makes "Lo más buscado" slightly less accurate. The database
// decides what is junk (see record_search_term).
export async function recordSearchTerm(term: string): Promise<void> {
  const query = parseSearchQuery(term);
  if (!query) return;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;
  await supabase.rpc("record_search_term", { search_term: query });
}
