import type { MetadataRoute } from "next";
import { demoProducts } from "@/features/products/demo-catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function siteUrl() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL ?? "localhost:3000";
  return site.startsWith("http") ? site : `https://${site}`;
}

// Every public garment page, so a new listing can show up in Google without waiting for a
// crawler to find it through the catalog's pagination. Same visibility rules as the detail
// page: published and not hidden by an admin.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const fixed: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/?audience=women`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/?audience=men`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/recolectoras`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/privacidad`, changeFrequency: "yearly", priority: 0.1 },
  ];

  if (process.env.CATALOG_DEMO_MODE === "true") {
    return [...fixed, ...demoProducts.map((product) => ({ url: `${base}/prendas/${product.slug}`, lastModified: product.created_at }))];
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return fixed;
  const { data } = await supabase.from("products").select("slug,updated_at")
    .eq("publication_status", "published").eq("hidden_by_admin", false)
    .order("created_at", { ascending: false }).limit(5000);
  return [...fixed, ...(data ?? []).map((product) => ({ url: `${base}/prendas/${product.slug}`, lastModified: product.updated_at }))];
}
