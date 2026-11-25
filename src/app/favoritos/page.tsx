import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductCard } from "@/components/catalog/product-card";
import { StoreHeader } from "@/components/store/store-header";
import { getProductImageUrl } from "@/features/products/public-images";
import type { CatalogImage, CatalogProduct } from "@/features/products/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Favoritos | BZRS Monterrey" };

type FavoriteRow = { product: (Omit<CatalogProduct, "images"> & { images: Omit<CatalogImage, "url">[] | null }) | null };

export default async function FavoritesPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/favoritos");

  const { data: rows } = await supabase.from("favorites")
    .select("product:products(id,slug,name,description,category,audience,size,condition,price_mxn,sale_status,created_at,seller_id,seller:profiles!products_seller_id_fkey(store_name,slug,avatar_path),images:product_images(id,source,storage_path,alt_text,position,width,height))")
    .order("created_at", { ascending: false });

  // A favorite whose product became hidden or unpublished drops out here (RLS hides the
  // product), rather than showing a broken card.
  const products: CatalogProduct[] = ((rows ?? []) as unknown as FavoriteRow[]).flatMap((row) => {
    if (!row.product || !row.product.seller) return [];
    const images = (row.product.images ?? [])
      .toSorted((a, b) => a.position - b.position)
      .map((image) => ({ ...image, url: getProductImageUrl(supabase, image) }));
    return [{ ...row.product, images }];
  });

  return (
    <>
      <StoreHeader />
      <main className="mx-auto min-h-screen w-full max-w-[1600px] px-4 pb-16 pt-8 sm:px-8 lg:px-12">
        <h1 className="font-heavy text-4xl uppercase tracking-tight text-stone-900 sm:text-5xl">Favoritos</h1>
        {products.length === 0 ? (
          <div className="mt-10 border-y border-stone-200 py-16 text-center">
            <p className="font-serif text-2xl text-stone-800">Aún no guardas favoritos.</p>
            <p className="mt-2 text-sm text-stone-600">Toca el corazón de una prenda para guardarla aquí.</p>
            <Link href="/" className="mt-6 inline-flex min-h-11 items-center border-b-2 border-pine font-condensed text-base font-bold uppercase text-pine">Ver prendas</Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-9 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 lg:gap-x-6">
            {products.map((product, index) => <ProductCard key={product.id} index={index} product={product} viewerId={user.id} favorite signedIn />)}
          </div>
        )}
      </main>
    </>
  );
}
