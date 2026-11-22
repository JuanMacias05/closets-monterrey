import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProductImageUrl } from "@/features/products/public-images";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DeliverySettings } from "@/app/panel/tienda/delivery-settings";
import { PaymentSettingsSummary } from "@/app/panel/tienda/payment-settings-summary";
import { ProductEditor, type EditableProduct } from "@/app/panel/prendas/product-editor";

export default async function EditProductPage({ params }: PageProps<"/panel/prendas/[id]">) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: row, error } = await supabase.from("products")
    .select("id,name,description,category,audience,size,condition,price_mxn,measurements,sale_status,images:product_images(id,source,storage_path,alt_text,position,width,height)")
    .eq("id", id).eq("seller_id", user.id)
    .order("position", { foreignTable: "product_images", ascending: true }).maybeSingle();
  if (error || !row) notFound();
  const product: EditableProduct = {
    id: row.id, name: row.name, description: row.description, category: row.category, audience: row.audience, size: row.size,
    condition: row.condition, price_mxn: row.price_mxn, measurements: row.measurements ?? {}, sale_status: row.sale_status,
    images: (row.images ?? []).map((image) => ({
      id: image.id, storage_path: image.storage_path, alt_text: image.alt_text, position: image.position,
      width: image.width, height: image.height, url: getProductImageUrl(supabase, image),
    })),
  };

  return (
    <section className="mx-auto max-w-3xl">
      {/* A garment sits inside Mis prendas and has no menu entry of its own: the one back link the
          panel keeps (the PANEL menu replaced every "Volver a Panel"). */}
      <Link href="/panel/prendas" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm text-stone-700 underline-offset-4 hover:underline"><span aria-hidden="true">←</span> Mis prendas</Link>
      <div className="mb-6 border-b border-stone-200 pb-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Editar catálogo</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight text-stone-900">Edita tu prenda</h1>
      </div>
      <div className="mb-8 space-y-3"><DeliverySettings sellerId={user.id} compact /><PaymentSettingsSummary sellerId={user.id} /></div>
      <ProductEditor sellerId={user.id} product={product} />
    </section>
  );
}
