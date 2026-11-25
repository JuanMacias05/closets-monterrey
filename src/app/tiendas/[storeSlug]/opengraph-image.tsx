import { ImageResponse } from "next/og";
import { getSellerProducts } from "@/features/products/product-detail-data";
import { getSellerPublicProfile } from "@/features/sellers/seller-storefront";
import { fetchPreviewPhoto } from "@/features/share/og-photo";

// The link preview of a store: its photo, or a collage of up to four of its garments, with the
// store's name and how many garments it has. Same reasons as the garment preview (stable public
// URL, light PNG).
export const alt = "Bazar en BZRS Monterrey";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const [seller, products] = await Promise.all([getSellerPublicProfile(storeSlug), getSellerProducts(storeSlug)]);
  const available = products.filter((product) => product.sale_status === "available");
  const avatar = await fetchPreviewPhoto(seller?.avatarUrl);
  const collage = avatar ? [] : (await Promise.all(available.slice(0, 4).map((product) => fetchPreviewPhoto(product.images[0]?.url)))).filter((photo): photo is ArrayBuffer => photo !== null);
  const name = seller?.storeName ?? "BZRS Monterrey";
  const count = available.length === 1 ? "1 prenda disponible" : `${available.length} prendas disponibles`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#faf9f6", fontFamily: "sans-serif" }}>
        <div style={{ width: 560, height: 630, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", background: "#e7e2da" }}>
          {avatar ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- ImageResponse draws plain <img>, no alt in a PNG
            <img src={avatar as unknown as string} width={420} height={420} style={{ borderRadius: 210, objectFit: "cover" }} />
          ) : collage.length > 0 ? (
            collage.map((photo, index) => (
              // eslint-disable-next-line jsx-a11y/alt-text -- ImageResponse draws plain <img>, no alt in a PNG
              <img key={index} src={photo as unknown as string} width={collage.length === 1 ? 560 : 280} height={collage.length === 1 ? 630 : 315} style={{ objectFit: "cover" }} />
            ))
          ) : (
            <div style={{ fontSize: 200, color: "#1f3a2f" }}>{name.slice(0, 1).toUpperCase()}</div>
          )}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 56px 48px" }}>
          <div style={{ fontSize: 26, color: "#57534e", textTransform: "uppercase", letterSpacing: 3 }}>Bazar</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 64, color: "#1c1917", lineHeight: 1.1 }}>{name}</div>
            <div style={{ marginTop: 18, fontSize: 36, color: "#1f3a2f" }}>{count}</div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", color: "#1f3a2f" }}><span style={{ fontSize: 28, letterSpacing: 5 }}>BZRS</span><span style={{ marginLeft: 10, fontSize: 19 }}>{"Monterrey · Compra y vende ropa"}</span></div>
        </div>
      </div>
    ),
    size,
  );
}
