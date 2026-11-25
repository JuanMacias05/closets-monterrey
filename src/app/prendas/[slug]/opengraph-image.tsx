import { ImageResponse } from "next/og";
import { getProductDetail } from "@/features/products/product-detail-data";
import { fetchPreviewPhoto } from "@/features/share/og-photo";
import { conditionLabel, shortPrice } from "@/features/share/share-text";

// The link preview of a garment on Facebook and WhatsApp: its first photo with the price and the
// size on it. A route of its own gives a stable public URL (a signed storage URL would expire
// inside the preview). 1200×630 is what Facebook asks for; the photo takes the left half so the
// PNG stays small enough for WhatsApp, which skips heavy previews.
export const alt = "Prenda en BZRS Monterrey";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  const photo = await fetchPreviewPhoto(product?.images[0]?.url);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#faf9f6", fontFamily: "sans-serif" }}>
        <div style={{ width: 560, height: 630, display: "flex", alignItems: "center", justifyContent: "center", background: "#e7e2da" }}>
          {photo ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- ImageResponse draws plain <img>, no alt in a PNG
            <img src={photo as unknown as string} width={560} height={630} style={{ objectFit: "cover" }} />
          ) : (
            <div style={{ fontSize: 160, color: "#1f3a2f" }}>{(product?.name ?? "B").slice(0, 1).toUpperCase()}</div>
          )}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 56px 48px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 26, color: "#57534e", textTransform: "uppercase", letterSpacing: 3 }}>{product?.seller.store_name ?? "BZRS Monterrey"}</div>
            <div style={{ marginTop: 18, fontSize: 52, color: "#1c1917", lineHeight: 1.1 }}>{product?.name ?? "Prenda"}</div>
          </div>
          {product && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 76, fontWeight: 700, color: "#1f3a2f" }}>{shortPrice(product.price_mxn)}</div>
              <div style={{ marginTop: 8, fontSize: 34, color: "#292524" }}>{`Talla ${product.size} · ${conditionLabel(product.condition)}`}</div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "baseline", color: "#1f3a2f" }}><span style={{ fontSize: 28, letterSpacing: 5 }}>BZRS</span><span style={{ marginLeft: 10, fontSize: 19 }}>{"Monterrey"}</span></div>
        </div>
      </div>
    ),
    size,
  );
}
