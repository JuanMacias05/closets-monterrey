import "server-only";

// A photo for a link preview, as bytes ImageResponse can draw. Only JPEG/PNG under 2 MB: the
// local placeholders are SVG (link previews can't use those either) and a broken or huge file
// must not break the preview, so anything else returns null and the card draws without it.
export async function fetchPreviewPhoto(url: string | null | undefined): Promise<ArrayBuffer | null> {
  if (!url) return null;
  try {
    const response = await fetch(new URL(url, siteOrigin()), { cache: "force-cache" });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !/^image\/(jpeg|png)/.test(type)) return null;
    const bytes = await response.arrayBuffer();
    return bytes.byteLength <= 2 * 1024 * 1024 ? bytes : null;
  } catch {
    return null;
  }
}

export function siteOrigin(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL ?? "localhost:3000";
  return site.startsWith("http") ? site : `https://${site}`;
}
