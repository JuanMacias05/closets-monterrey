import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DeliverySettings } from "@/app/panel/tienda/delivery-settings";
import { ProductEditor } from "@/app/panel/prendas/product-editor";

export default async function NewProductPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-6 border-b border-stone-200 pb-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Agregar al catálogo</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight text-stone-900">Nueva prenda</h1>
      </div>
      <div className="mb-8"><DeliverySettings sellerId={user.id} compact /></div>
      <ProductEditor sellerId={user.id} product={null} />
    </section>
  );
}
