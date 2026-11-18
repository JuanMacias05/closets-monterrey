import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const linkClass = "inline-flex min-h-11 items-center border-b border-stone-800 px-1 text-xs uppercase tracking-[0.16em] text-stone-800";

export default async function PanelHomePage() {
  const supabase = await createSupabaseServerClient();
  let role: string | null = null;
  let openReservations = 0;
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.rpc("release_expired_reservations");
      const [{ data: profile }, { count }] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
        supabase.from("reservations").select("id", { count: "exact", head: true })
          .eq("seller_id", user.id).in("status", ["pending_deposit", "confirmed"]),
      ]);
      role = profile?.role ?? null;
      openReservations = count ?? 0;
    }
  }
  return (
    <section className="border-y border-stone-200 py-8">
      <h1 className="font-serif text-3xl tracking-tight text-stone-900">Mi tienda</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600">Administra el perfil público y los datos de contacto de tu tienda.</p>
      <nav aria-label="Panel" className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        <Link href="/panel/tienda" className={linkClass}>Editar tienda</Link>
        <Link href="/panel/apartados" className={linkClass}>Apartados{openReservations > 0 ? ` (${openReservations})` : ""}</Link>
        <Link href="/panel/prendas" className={linkClass}>Administrar prendas</Link>
        {role === "admin" && <Link href="/panel/admin/vendedoras" className={linkClass}>Vendedoras</Link>}
        {role === "admin" && <Link href="/panel/admin/clientas" className={linkClass}>Clientas</Link>}
        {role === "admin" && <Link href="/panel/admin/prendas" className={linkClass}>Administrar catálogo</Link>}
      </nav>
    </section>
  );
}
