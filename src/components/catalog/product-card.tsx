import Image from "next/image";
import Link from "next/link";
import type { CatalogProduct } from "@/features/products/types";
import { formatPriceMXN } from "@/features/products/format-price";

const conditionLabels = { new: "Nuevo", like_new: "Como nuevo", used: "Usado" } as const;

export function ProductCard({ product, priority = false }: { product: CatalogProduct; priority?: boolean }) {
  const firstImage = product.images[0];
  const secondImage = product.images[1];

  return (
    <article className="group min-w-0">
      <div className="relative aspect-[3/4] overflow-hidden bg-stone-100">
        <Link href={`/prendas/${product.slug}`} aria-label={`Ver ${product.name}`} className="absolute inset-0">
          {firstImage ? (
            <Image src={firstImage.url} alt={firstImage.alt_text || product.name} fill priority={priority} sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025]" />
          ) : (
            <div aria-label={`Imagen de ${product.name} no disponible`} role="img" className="absolute inset-0 bg-stone-200" />
          )}
          {secondImage && <Image src={secondImage.url} alt={secondImage.alt_text || `${product.name}, segunda vista`} fill sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw" className="object-cover opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100 motion-reduce:transition-none" />}
        </Link>
        {product.sale_status !== "available" && (
          <span className={`absolute left-2 top-2 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] sm:left-3 sm:top-3 ${product.sale_status === "sold" ? "bg-stone-900 text-white" : "bg-[#eee4d8] text-stone-800"}`}>
            {product.sale_status === "sold" ? "Vendida" : "Apartada"}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 pt-3 sm:pt-4">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h2 className="min-w-0 text-sm font-normal leading-5 text-stone-900 sm:text-base"><Link href={`/prendas/${product.slug}`} className="focus-visible:underline">{product.name}</Link></h2>
          <span className="shrink-0 text-xs text-stone-500 sm:text-sm">Talla {product.size}</span>
        </div>
        <p className="text-xs text-stone-500">{product.seller.store_name}</p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-sm tracking-wide text-stone-900">{formatPriceMXN(product.price_mxn)}</p>
          <p className="text-[10px] text-stone-400">{conditionLabels[product.condition]}</p>
        </div>
      </div>
    </article>
  );
}
