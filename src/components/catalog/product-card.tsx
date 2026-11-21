import Image from "next/image";
import Link from "next/link";
import type { CatalogProduct } from "@/features/products/types";
import { formatPriceMXN } from "@/features/products/format-price";
import { OwnerProductActions } from "@/components/catalog/owner-product-actions";
import { FavoriteButton } from "@/components/shop/favorite-button";

const conditionLabels = { new: "Nuevo", like_new: "Como nuevo", used: "Usado" } as const;

// `index` staggers the entrance animation (see .card-enter in globals.css).
export function ProductCard({ product, priority = false, viewerId, favorite = false, signedIn = false, index = 0 }: {
  product: CatalogProduct; priority?: boolean; viewerId?: string; favorite?: boolean; signedIn?: boolean; index?: number;
}) {
  const isOwn = viewerId !== undefined && product.seller_id === viewerId;
  const firstImage = product.images[0];
  const secondImage = product.images[1];

  return (
    <article style={{ "--stagger": index } as React.CSSProperties} className={`card-enter group min-w-0 ${isOwn ? "outline-2 outline-offset-4 outline-pine" : ""}`}>
      {/* The photo frame is the card: it lifts with a soft shadow on hover (no lift with reduced motion). */}
      <div className="relative aspect-[3/4] overflow-hidden bg-stone-100 transition-[translate,box-shadow] duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-[0_18px_32px_-18px_rgba(28,25,23,0.45)] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        <Link href={`/prendas/${product.slug}`} aria-label={`Ver ${product.name}`} className="absolute inset-0">
          {firstImage ? (
            <Image src={firstImage.url} alt={firstImage.alt_text || product.name} fill priority={priority} sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
          ) : (
            <div aria-label={`Imagen de ${product.name} no disponible`} role="img" className="absolute inset-0 bg-stone-200" />
          )}
          {secondImage && <Image src={secondImage.url} alt={secondImage.alt_text || `${product.name}, segunda vista`} fill sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw" className="object-cover opacity-0 transition-[opacity,scale] duration-700 ease-out group-hover:scale-[1.04] group-hover:opacity-100 motion-reduce:transition-none motion-reduce:group-hover:scale-100" />}
        </Link>
        {!isOwn && <FavoriteButton productId={product.id} productName={product.name} initial={favorite} signedIn={signedIn} className="absolute right-1 top-1 bg-white/70 backdrop-blur-sm" />}
        <div className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1 sm:left-3 sm:top-3">
          {isOwn && <span className="bg-pine px-2.5 py-1 font-condensed text-xs font-bold uppercase tracking-[0.06em] text-white">Tu prenda</span>}
          {product.sale_status !== "available" && (
            <span className={`px-2.5 py-1 font-condensed text-xs font-bold uppercase tracking-[0.06em] ${product.sale_status === "sold" ? "bg-stone-900 text-white" : "border border-pine bg-white text-pine"}`}>
              {product.sale_status === "sold" ? "Vendida" : "Apartada"}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 pt-3 sm:pt-4">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h2 className="min-w-0 text-sm font-normal leading-5 text-stone-900 sm:text-base"><Link href={`/prendas/${product.slug}`} className="focus-visible:underline">{product.name}</Link></h2>
          <span className="shrink-0 text-xs text-stone-500 sm:text-sm">Talla {product.size}</span>
        </div>
        <p className="text-xs text-stone-500"><Link href={`/tiendas/${product.seller.slug}`} className="hover:text-stone-900 hover:underline">{product.seller.store_name}</Link></p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-sm tracking-wide text-stone-900">{formatPriceMXN(product.price_mxn)}</p>
          <p className="text-[10px] text-stone-500">{conditionLabels[product.condition]}</p>
        </div>
        {isOwn && <OwnerProductActions productId={product.id} productName={product.name} saleStatus={product.sale_status} />}
      </div>
    </article>
  );
}
