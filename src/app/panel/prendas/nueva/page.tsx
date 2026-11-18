import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProductEditor } from "@/app/panel/prendas/product-editor";

export default async function NewProductPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return (
    <section className="mx-auto max-w-3xl">
      <Link href="/panel/prendas" className="text-xs uppercase tracking-[0.14em] text-stone-600 underline underline-offset-4">← Mis prendas</Link>
      <div className="mb-7 mt-5 border-b border-stone-200 pb-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Agregar al catálogo</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight text-stone-900">Nueva prenda</h1>
      </div>
      <ProductEditor sellerId={user.id} product={null} />
    </section>
  );
}
