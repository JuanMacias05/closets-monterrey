import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getProductImageUrl } from "@/features/products/public-images";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PRIMARY_BUTTON_CLASS } from "@/components/panel/panel-styles";
import { ShareButton } from "@/components/share/share-button";
import { formatPriceMXN } from "@/features/products/format-price";
import { ProductListActions } from "@/app/panel/prendas/product-list-actions";
import { ProductPriceEditor } from "@/app/panel/prendas/product-price-editor";

export default async function ProductsPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows, error } = await supabase.from("products")
    .select("id,slug,name,price_mxn,sale_status,publication_status,hidden_by_admin,images:product_images(id,source,storage_path,alt_text,position)")
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
        <Link href="/panel/prendas/nueva" className={`${PRIMARY_BUTTON_CLASS} shrink-0`}>Subir prenda</Link>
      </div>
      {products.length === 0 ? (
        <Link href="/panel/prendas/nueva" className="mt-8 flex flex-col items-center border border-dashed border-stone-400 bg-white px-6 py-12 text-center hover:border-stone-700">
          <span className="font-serif text-xl text-stone-900">Todavía no tienes prendas</span>
          <span className="mt-2 text-sm text-stone-600">Toma unas fotos, ponle precio y aparece en la tienda.</span>
          <span className="mt-4 text-xs uppercase tracking-[0.14em] text-stone-800 underline underline-offset-4">Sube tu primera prenda</span>
        </Link>
      ) : (
        <ul className="divide-y divide-stone-200">
          {products.map((product) => {
            const mainImage = product.images[0];
            // Only what a shopper can actually open is worth sharing.
            const shareable = product.publication_status === "published" && product.sale_status === "available" && !product.hidden_by_admin;
            const actions = (
              <div className="flex flex-wrap items-start gap-x-4 sm:flex-col sm:items-end">
                <ProductListActions productId={product.id} saleStatus={product.sale_status} />
                {shareable && <ShareButton path={`/prendas/${product.slug}`} title={product.name} text={`${product.name} · ${formatPriceMXN(product.price_mxn)}`} />}
              </div>
            );
            return (
              <li key={product.id} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 py-4 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:items-center sm:gap-5">
                <Link href={`/panel/prendas/${product.id}`} aria-label={`Editar ${product.name}`} className="relative aspect-[3/4] overflow-hidden bg-stone-100">
                  {mainImage ? <Image src={mainImage.url} alt={mainImage.alt_text || product.name} fill sizes="96px" unoptimized className="object-cover" /> : <span className="absolute inset-0 flex items-center justify-center text-[10px] text-stone-500">Sin foto</span>}
                </Link>
                <div className="min-w-0">
                  <Link href={`/panel/prendas/${product.id}`} className="font-serif text-lg leading-6 text-stone-900">{product.name}</Link>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-stone-600">
                    <ProductPriceEditor productId={product.id} productName={product.name} priceInCents={product.price_mxn} editable={product.sale_status === "available"} />
                    <span aria-hidden="true">·</span>
                    {product.images.length === 0
                      ? <span className="font-medium text-amber-800">Sin fotos: agrega al menos una</span>
                      : <span>{product.images.length} {product.images.length === 1 ? "foto" : "fotos"}</span>}
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-stone-500">
                    {product.sale_status === "sold" ? "Vendida" : product.sale_status === "reserved" ? "Apartada" : "Disponible"}
                    {product.publication_status === "draft" ? " · Borrador" : " · Publicada"}
                  </p>
                  {product.hidden_by_admin && <p className="mt-1 text-xs font-medium text-amber-800">Oculta por administración</p>}
                  <div className="mt-3 sm:hidden">{actions}</div>
                </div>
                <div className="hidden sm:block">{actions}</div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
