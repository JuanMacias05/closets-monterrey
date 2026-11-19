import type { MetadataRoute } from "next";

function siteUrl() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL ?? "localhost:3000";
  return site.startsWith("http") ? site : `https://${site}`;
}

// Private areas stay out of search results: they're behind login anyway, but a crawler that
// follows a link there would index the login page under the panel's URL.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/panel", "/cuenta", "/carrito", "/favoritos", "/recolectora", "/login", "/registro", "/auth"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
