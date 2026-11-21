import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/products/product-gallery";
import { ProductGridSkeleton, SkeletonBlock } from "@/components/catalog/catalog-skeleton";
import { ProductCard } from "@/components/catalog/product-card";
import { SellerDeliveryList } from "@/components/sellers/seller-delivery";
import { StoreFooter } from "@/components/store/store-footer";
import { StoreHeader } from "@/components/store/store-header";
import { AddToCartButton } from "@/components/shop/add-to-cart-button";
import { FavoriteButton } from "@/components/shop/favorite-button";
import { getShopState } from "@/features/shop/shop-state";
import { getViewer } from "@/features/viewer/get-viewer";
import { getMoreFromSeller, getProductDetail } from "@/features/products/product-detail-data";
import { getSellerPublicProfile } from "@/features/sellers/seller-storefront";
import { formatPriceMXN } from "@/features/products/format-price";
import { PRODUCT_CATEGORIES } from "@/features/products/types";

type PageProps = { params: Promise<{ slug: string }> };

const conditionLabels = { new: "Nuevo", like_new: "Como nuevo", used: "Usado" } as const;
const measurementLabels: Record<string, string> = {
  busto_cm: "Busto",
  cintura_cm: "Cintura",
  cadera_cm: "Cadera",
  largo_cm: "Largo",
  largo_pie_cm: "Largo del pie",
  tacon_cm: "Tacón",
  ancho_cm: "Ancho",
  alto_cm: "Alto",
};

function siteOrigin() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL;
  if (!site) return new URL("http://localhost:3000");
  return new URL(site.startsWith("http") ? site : `https://${site}`);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) return { title: "Prenda no encontrada | Closets Monterrey" };

  const title = `${product.name} | Closets Monterrey`;
  const description = `${formatPriceMXN(product.price_mxn)} · Talla ${product.size} · ${product.seller.store_name}`;
  const image = product.images[0];
  const imageUrl = image ? new URL(image.url, siteOrigin()).toString() : undefined;

  return {
    title,
    description,
    alternates: { canonical: `/prendas/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.name,
      description,
      url: `/prendas/${product.slug}`,
      ...(imageUrl && {
        images: [{
          url: imageUrl,
          width: image?.width ?? 900,
          height: image?.height ?? 1100,
          alt: image?.alt_text || product.name,
        }],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
      ...(imageUrl && { images: [imageUrl] }),
    },
  };
}

function Measurements({ measurements }: { measurements: Record<string, number> }) {
  const entries = Object.entries(measurements).filter(([, value]) => Number.isFinite(value));
  if (!entries.length) return null;

  return (
    <section className="border-t border-stone-200 py-5">
      <h2 className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Medidas aproximadas</h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {entries.map(([key, value]) => (
          <div key={key} className="flex justify-between gap-3 text-stone-700">
            <dt>{measurementLabels[key] ?? key.replaceAll("_", " ")}</dt>
            <dd className="tabular-nums">{value} cm</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) notFound();

  const [shop, viewer, sellerProfile] = await Promise.all([getShopState(), getViewer(), getSellerPublicProfile(product.seller.slug)]);
  const isOwn = viewer.kind !== "guest" && product.seller_id === viewer.userId;
  const category = PRODUCT_CATEGORIES.find((item) => item.value === product.category)?.label ?? product.category;
  const saleLabel = product.sale_status === "reserved" ? "Apartada" : product.sale_status === "sold" ? "Vendida" : null;
  const unavailable = product.sale_status !== "available";

  return (
    <>
    <StoreHeader />
    <main className="mx-auto min-h-screen w-full max-w-[1600px] px-4 pb-14 sm:px-8 lg:px-12">

      <nav aria-label="Ruta de navegación" className="py-5 text-[10px] uppercase tracking-[0.16em] text-stone-400 sm:py-7">
        <Link href="/" className="hover:text-stone-800">Catálogo</Link><span className="px-2">/</span><span className="text-stone-700">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:gap-16 xl:gap-24">
        <ProductGallery productName={product.name} images={product.images} />

        {/* top-32 clears the sticky store header; top-8 slid the column under it. */}
        <section className="lg:sticky lg:top-32 lg:h-fit lg:py-2">
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-stone-500">
            <span>{category}</span><span aria-hidden="true">·</span><span>{conditionLabels[product.condition]}</span>
          </div>
          <div className="mt-3 flex items-start justify-between gap-3">
            <h1 className="font-serif text-3xl leading-tight tracking-tight text-stone-900 sm:text-4xl">{product.name}</h1>
            {!isOwn && <FavoriteButton productId={product.id} productName={product.name} initial={shop.favoriteIds.has(product.id)} signedIn={shop.signedIn} className="shrink-0 border border-stone-300" />}
          </div>
          <p className="mt-4 text-lg tracking-wide text-stone-900">{formatPriceMXN(product.price_mxn)}</p>

          {saleLabel && (
            <p className={`mt-6 inline-flex px-3 py-2 text-[10px] uppercase tracking-[0.18em] ${product.sale_status === "sold" ? "bg-stone-900 text-white" : "bg-[#eee4d8] text-stone-800"}`} role="status">
              {saleLabel}
            </p>
          )}

          <dl className="mt-7 grid grid-cols-2 gap-4 border-y border-stone-200 py-5 text-sm">
            <div><dt className="text-xs text-stone-500">Talla</dt><dd className="mt-1 text-stone-900">{product.size}</dd></div>
            <div><dt className="text-xs text-stone-500">Estado</dt><dd className="mt-1 text-stone-900">{conditionLabels[product.condition]}</dd></div>
          </dl>

          <Measurements measurements={product.measurements ?? {}} />

          {product.description && (
            <section className="border-t border-stone-200 py-5">
              <h2 className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Descripción</h2>
              <p className="mt-3 text-sm leading-6 text-stone-700">{product.description}</p>
            </section>
          )}

          <div className="border-t border-stone-200 pt-5">
            <Link href={`/tiendas/${product.seller.slug}`} className="group flex items-center gap-3">
              {product.seller.avatar_path ? (
                <Image src={product.seller.avatar_path} alt={`Foto de ${product.seller.store_name}`} width={48} height={48} className="size-12 rounded-full object-cover" />
              ) : (
                <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-stone-200 font-serif text-lg text-stone-700">{product.seller.store_name.slice(0, 1).toUpperCase()}</span>
              )}
              <span><span className="block text-[10px] uppercase tracking-[0.18em] text-stone-500">Vendido por</span><span className="mt-1 block text-sm text-stone-900 underline-offset-4 group-hover:underline">{product.seller.store_name}</span><span className="mt-0.5 block text-xs text-pine">Ver su tienda →</span></span>
            </Link>
          </div>

          {/* Before reserving, a shopper needs to know whether this seller reaches her. */}
          {sellerProfile && (
            <section aria-labelledby="entrega-title" className="mt-5 border-t border-stone-200 pt-5">
              <h2 id="entrega-title" className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Entrega</h2>
              <div className="mt-3"><SellerDeliveryList delivery={sellerProfile.delivery} /></div>
            </section>
          )}

          <AddToCartButton productId={product.id} initial={shop.cartIds.has(product.id)} signedIn={shop.signedIn} available={!unavailable} isOwn={isOwn} />
          {isOwn && <p className="mt-7 text-center text-sm text-stone-600">Es una prenda de tu tienda. <Link href={`/panel/prendas/${product.id}`} className="text-pine underline underline-offset-4">Editarla</Link></p>}
          {unavailable && !isOwn && <p className="mt-2 text-center text-xs text-stone-500">Esta prenda ya no está disponible.</p>}
          {!unavailable && !isOwn && <p className="mt-3 text-center text-xs leading-5 text-stone-600">Agregarla al carrito no la aparta. Se aparta al dar &ldquo;Apartar&rdquo; en tu carrito, con un anticipo a la vendedora.</p>}
        </section>
      </div>

      {/* The seller's other garments stream in behind skeleton cards, so the garment itself shows
          without waiting for them. (No loading.tsx for this route: its fallback would start the
          response before notFound() runs and turn a missing garment's 404 into a 200.) */}
      <Suspense fallback={<RelatedProductsSkeleton />}>
        <RelatedProducts sellerSlug={product.seller.slug} sellerName={product.seller.store_name} productId={product.id} />
      </Suspense>

      <StoreFooter className="mt-14" />
    </main>
    </>
  );
}

async function RelatedProducts({ sellerSlug, sellerName, productId }: { sellerSlug: string; sellerName: string; productId: string }) {
  const related = await getMoreFromSeller(sellerSlug, productId);
  if (related.length === 0) return null;

  return (
    <section className="mt-16 border-t border-stone-200 pt-10 sm:mt-24 sm:pt-14">
      <div className="mb-7 flex items-end justify-between gap-4">
        <div><p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Explora su selección</p><h2 className="mt-2 font-serif text-2xl text-stone-900 sm:text-3xl">Más prendas de {sellerName}</h2></div>
        <Link href={`/tiendas/${sellerSlug}`} className="inline-flex min-h-11 items-center text-sm text-pine underline underline-offset-4">Ver toda su tienda</Link>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-9 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 lg:gap-x-6">
        {related.map((item, index) => <ProductCard key={item.id} index={index} product={item} />)}
      </div>
    </section>
  );
}

function RelatedProductsSkeleton() {
  return (
    <section aria-busy="true" aria-label="Cargando más prendas" className="mt-16 border-t border-stone-200 pt-10 sm:mt-24 sm:pt-14">
      <div className="mb-7 flex flex-col gap-2">
        <SkeletonBlock className="h-3 w-32" />
        <SkeletonBlock className="h-8 w-64 max-w-full" />
      </div>
      <ProductGridSkeleton count={4} />
    </section>
  );
}
