import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getProductImageUrl } from "@/features/products/public-images";
import { formatPriceMXN } from "@/features/products/format-price";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProductListActions } from "@/app/panel/prendas/product-list-actions";

export default async function ProductsPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows, error } = await supabase.from("products")
    .select("id,slug,name,price_mxn,sale_status,publication_status,images:product_images(id,source,storage_path,alt_text,position)")
    .eq("seller_id", user.id).order("created_at", { ascending: false })
    .order("position", { foreignTable: "product_images", ascending: true });
  if (error) throw new Error("No pudimos cargar tus prendas.");
  const products = (rows ?? []).map((product) => ({
    ...product,
    images: (product.images ?? []).map((image) => ({ ...image, url: getProductImageUrl(supabase, image) })),
  }));

  return (
    <section className="mx-auto max-w-4xl">
      <div className="flex items-end justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Mi catálogo</p>
          <h1 className="mt-2 font-serif text-3xl tracking-tight text-stone-900">Mis prendas</h1>
        </div>
        <Link href="/panel/prendas/nueva" className="inline-flex min-h-11 shrink-0 items-center bg-stone-900 px-4 text-xs uppercase tracking-[0.14em] text-white">Agregar prenda</Link>
      </div>
      {products.length === 0 ? (
        <div className="py-14 text-center">
          <p className="font-serif text-xl">Todavía no tienes prendas</p>
          <p className="mt-2 text-sm text-stone-600">Agrega tu primera prenda para mostrarla en tu tienda.</p>
        </div>
      ) : (
        <ul className="divide-y divide-stone-200">
          {products.map((product) => {
            const mainImage = product.images[0];
            return (
              <li key={product.id} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 py-4 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:items-center sm:gap-5">
                <Link href={`/panel/prendas/${product.id}`} aria-label={`Editar ${product.name}`} className="relative aspect-[3/4] overflow-hidden bg-stone-100">
                  {mainImage ? <Image src={mainImage.url} alt={mainImage.alt_text || product.name} fill sizes="96px" unoptimized className="object-cover" /> : <span className="absolute inset-0 flex items-center justify-center text-[10px] text-stone-500">Sin foto</span>}
                </Link>
                <div className="min-w-0">
                  <Link href={`/panel/prendas/${product.id}`} className="font-serif text-lg leading-6 text-stone-900">{product.name}</Link>
                  <p className="mt-1 text-sm text-stone-600">{formatPriceMXN(product.price_mxn)} · {product.images.length} {product.images.length === 1 ? "foto" : "fotos"}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-stone-500">
                    {product.sale_status === "sold" ? "Vendida" : product.sale_status === "reserved" ? "Apartada" : "Disponible"}
                    {product.publication_status === "draft" ? " · Borrador" : " · Publicada"}
                  </p>
                  <div className="mt-3 sm:hidden"><ProductListActions productId={product.id} saleStatus={product.sale_status} /></div>
                </div>
                <div className="hidden sm:block"><ProductListActions productId={product.id} saleStatus={product.sale_status} /></div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
