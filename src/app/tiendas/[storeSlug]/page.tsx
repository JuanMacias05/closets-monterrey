import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/catalog/product-card";
import { SellerDeliveryList } from "@/components/sellers/seller-delivery";
import { StoreFooter } from "@/components/store/store-footer";
import { StoreHeader } from "@/components/store/store-header";
import { getSellerProducts } from "@/features/products/product-detail-data";
import { getSellerPublicProfile } from "@/features/sellers/seller-storefront";
import { getShopState } from "@/features/shop/shop-state";
import { getViewer } from "@/features/viewer/get-viewer";

type PageProps = { params: Promise<{ storeSlug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const seller = await getSellerPublicProfile((await params).storeSlug);
  if (!seller) return { title: "Tienda no encontrada | Closets Monterrey" };
  return { title: `${seller.storeName} | Closets Monterrey`, description: `Prendas de ${seller.storeName} en Closets Monterrey.` };
}

// A seller's public storefront: who she is, where she delivers and everything she has for
// sale. Reached from "Vendido por" on any of her garments.
//
// Lives outside the (marketplace) group on purpose: that group's loading.tsx streams a catalog
// skeleton, and once a response streams, notFound() can no longer turn it into a 404.
export default async function SellerStorefrontPage({ params }: PageProps) {
  const { storeSlug } = await params;
  const seller = await getSellerPublicProfile(storeSlug);
  if (!seller) notFound();
  const [products, shop, viewer] = await Promise.all([getSellerProducts(storeSlug), getShopState(), getViewer()]);
  const viewerId = viewer.kind === "guest" ? undefined : viewer.userId;
  const available = products.filter((product) => product.sale_status === "available").length;

  return (
    <>
      <StoreHeader />
      <main className="mx-auto min-h-screen w-full max-w-[1600px] px-4 pb-12 sm:px-8 lg:px-12">
        <nav aria-label="Ruta de navegación" className="py-5 text-[10px] uppercase tracking-[0.16em] text-stone-400 sm:py-7">
          <Link href="/" className="hover:text-stone-800">Catálogo</Link><span className="px-2">/</span><span className="text-stone-700">{seller.storeName}</span>
        </nav>

        <section className="grid gap-8 border-b border-stone-200 pb-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
          <div className="flex items-center gap-5">
            {seller.avatarUrl ? (
              <Image src={seller.avatarUrl} alt={`Foto de ${seller.storeName}`} width={96} height={96} className="size-20 rounded-full object-cover sm:size-24" />
            ) : (
              <span aria-hidden="true" className="grid size-20 place-items-center rounded-full bg-stone-200 font-serif text-3xl text-stone-700 sm:size-24">{seller.storeName.slice(0, 1).toUpperCase()}</span>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Vendedora</p>
              <h1 className="mt-1 font-serif text-3xl tracking-tight text-stone-900 sm:text-4xl">{seller.storeName}</h1>
              <p className="mt-2 text-sm text-stone-600">{available} {available === 1 ? "prenda disponible" : "prendas disponibles"}</p>
            </div>
          </div>
          <div className="border border-stone-200 bg-white p-5">
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Dónde entrega</h2>
            <div className="mt-3"><SellerDeliveryList delivery={seller.delivery} /></div>
          </div>
        </section>

        {products.length === 0 ? (
          <p className="py-16 text-center text-sm text-stone-600">Esta tienda todavía no tiene prendas publicadas.</p>
        ) : (
          <div data-testid="seller-product-grid" className="mt-8 grid grid-cols-2 gap-x-3 gap-y-9 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 lg:gap-x-6">
            {products.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 4} viewerId={viewerId} favorite={shop.favoriteIds.has(product.id)} signedIn={shop.signedIn} />
            ))}
          </div>
        )}

        <StoreFooter className="mt-14" />
      </main>
    </>
  );
}
