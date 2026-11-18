import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PanelHomePage() {
  const supabase = await createSupabaseServerClient();
  let role: string | null = null;
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      role = profile?.role ?? null;
    }
  }
  return (
    <section className="border-y border-stone-200 py-8">
      <h1 className="font-serif text-3xl tracking-tight text-stone-900">Mi tienda</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600">Administra el perfil público y los datos de contacto de tu tienda.</p>
      <Link href="/panel/tienda" className="mt-6 inline-flex min-h-11 items-center border-b border-stone-800 px-1 text-xs uppercase tracking-[0.16em] text-stone-800">Editar tienda</Link>
      <Link href="/panel/prendas" className="ml-6 inline-flex min-h-11 items-center border-b border-stone-800 px-1 text-xs uppercase tracking-[0.16em] text-stone-800">Administrar prendas</Link>
      {role === "admin" && <Link href="/panel/admin/vendedoras" className="ml-6 inline-flex min-h-11 items-center border-b border-stone-800 px-1 text-xs uppercase tracking-[0.16em] text-stone-800">Vendedoras</Link>}
      {role === "admin" && <Link href="/panel/admin/prendas" className="ml-6 inline-flex min-h-11 items-center border-b border-stone-800 px-1 text-xs uppercase tracking-[0.16em] text-stone-800">Administrar catálogo</Link>}
    </section>
  );
}
