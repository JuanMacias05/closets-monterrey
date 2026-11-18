import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatPriceMXN } from "@/features/products/format-price";
import { getProductImageUrl } from "@/features/products/public-images";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { VisibilityAction } from "@/app/panel/admin/prendas/visibility-action";

export default async function AdminProductsPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: admin, error: adminError } = await supabase.from("profiles")
    .select("role,status").eq("id", user.id).maybeSingle();
  if (adminError || admin?.role !== "admin" || admin.status !== "approved") redirect("/panel");

  const { data: rows, error } = await supabase.from("products")
    .select("id,slug,name,price_mxn,sale_status,publication_status,hidden_by_admin,seller:profiles!products_seller_id_fkey(store_name),images:product_images(id,source,storage_path,alt_text,position)")
    .order("created_at", { ascending: false })
    .order("position", { foreignTable: "product_images", ascending: true });
  if (error) throw new Error("No pudimos cargar el catálogo para administración.");

  const products = (rows ?? []).map((product) => {
    const seller = Array.isArray(product.seller) ? product.seller[0] : product.seller;
    const images = (product.images ?? []).map((image) => ({ ...image, url: getProductImageUrl(supabase, image) }));
    return { ...product, seller, images };
  });

  return (
    <section className="mx-auto max-w-5xl">
      <div className="flex items-end justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <Link href="/panel" className="text-[10px] uppercase tracking-[0.2em] text-stone-500 underline underline-offset-4">Administración</Link>
          <h1 className="mt-2 font-serif text-3xl tracking-tight text-stone-900">Catálogo de prendas</h1>
          <p className="mt-2 text-sm text-stone-600">Desde aquí solo puedes cambiar si una prenda aparece en el catálogo.</p>
        </div>
        <p className="shrink-0 text-xs text-stone-500">{products.length} prendas</p>
      </div>
      {products.length === 0 ? (
        <p className="py-12 text-center text-sm text-stone-600">Todavía no hay prendas en el catálogo.</p>
      ) : (
        <ul className="divide-y divide-stone-200">
          {products.map((product) => {
            const mainImage = product.images[0];
            return (
              <li key={product.id} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 py-4 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:items-center sm:gap-5">
                <div className="relative aspect-[3/4] overflow-hidden bg-stone-100">
                  {mainImage ? <Image src={mainImage.url} alt={mainImage.alt_text || product.name} fill sizes="96px" unoptimized className="object-cover" /> : <span className="absolute inset-0 flex items-center justify-center text-[10px] text-stone-500">Sin foto</span>}
                </div>
                <div className="min-w-0">
                  <h2 className="font-serif text-lg leading-6 text-stone-900">{product.name}</h2>
                  <p className="mt-1 truncate text-sm text-stone-600">{product.seller?.store_name ?? "Tienda sin nombre"} · {formatPriceMXN(product.price_mxn)}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-stone-500">
                    {product.sale_status === "sold" ? "Vendida" : product.sale_status === "reserved" ? "Apartada" : "Disponible"}
                    {product.publication_status === "draft" ? " · Borrador" : " · Publicada"}
                    {product.hidden_by_admin ? " · Oculta por administración" : " · Visible"}
                  </p>
                  <div className="mt-3 sm:hidden"><VisibilityAction productId={product.id} hidden={product.hidden_by_admin} /></div>
                </div>
                <div className="hidden sm:block"><VisibilityAction productId={product.id} hidden={product.hidden_by_admin} /></div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
