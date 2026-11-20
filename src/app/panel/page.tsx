import Link from "next/link";
import { PRIMARY_BUTTON_CLASS } from "@/components/panel/panel-styles";
import { ShareLinkButton } from "@/components/panel/share-link-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Panel home. Two groups, so a seller only ever sees her own tools: "Mi tienda" for every
// approved seller, "Administración del sitio" only for role = admin. The summary cards up top are
// what needs attention today; each links to the list behind it.
//
// IMPORTANT: a count that failed to load is shown as "—", never 0. A 0 says "nothing to do",
// and a query that failed must not tell the admin that.

type Count = number | null;

async function count(query: PromiseLike<{ count: number | null; error: unknown }>): Promise<Count> {
  const { count: value, error } = await query;
  return error ? null : (value ?? 0);
}

export default async function PanelHomePage() {
  const supabase = await createSupabaseServerClient();
  let isAdmin = false;
  let storeName = "";
  let storeSlug = "";
  let approved = false;
  let stats: { available: Count; reserved: Count; sold: Count; toConfirm: Count; proofsToReview: Count; pendingSellers: Count; pendingCouriers: Count; openSupport: Count } = {
    available: null, reserved: null, sold: null, toConfirm: null, proofsToReview: null, pendingSellers: null, pendingCouriers: null, openSupport: null,
  };

  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.rpc("release_expired_reservations");
      const { data: profile } = await supabase.from("profiles").select("role,store_name,slug,status").eq("id", user.id).maybeSingle();
      isAdmin = profile?.role === "admin";
      storeName = profile?.store_name ?? "";
      storeSlug = profile?.slug ?? "";
      approved = profile?.status === "approved";
      const ownProducts = (status: string) => supabase.from("products").select("id", { count: "exact", head: true })
        .eq("seller_id", user.id).eq("sale_status", status);
      const [available, reserved, sold, toConfirm, proofsToReview, pendingSellers, pendingCouriers, openSupport] = await Promise.all([
        count(ownProducts("available")),
        count(ownProducts("reserved")),
        count(ownProducts("sold")),
        count(supabase.from("reservations").select("id", { count: "exact", head: true })
          .eq("seller_id", user.id).eq("status", "pending_deposit")),
        count(supabase.from("reservations").select("id", { count: "exact", head: true })
          .eq("seller_id", user.id).eq("status", "pending_deposit").not("proof_submitted_at", "is", null).is("proof_rejected_at", null)),
        isAdmin ? count(supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending")) : Promise.resolve(null),
        isAdmin ? count(supabase.from("couriers").select("id", { count: "exact", head: true }).eq("status", "pending")) : Promise.resolve(null),
        isAdmin ? count(supabase.from("support_requests").select("id", { count: "exact", head: true }).eq("status", "open")) : Promise.resolve(null),
      ]);
      stats = { available, reserved, sold, toConfirm, proofsToReview, pendingSellers, pendingCouriers, openSupport };
    }
  }

  return (
    <div className="space-y-10">
      <section className="flex flex-col gap-5 border-b border-stone-200 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">{isAdmin ? "Administración" : "Panel de vendedora"}</p>
          <h1 className="mt-2 font-serif text-3xl tracking-tight text-stone-900">{storeName || "Tu panel"}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">
            {isAdmin
              ? "Sube y administra tus prendas, revisa tus apartados y aprueba cuentas nuevas."
              : "Sube y administra tus prendas, revisa tus apartados y edita tu tienda."}
          </p>
          {approved && storeSlug && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <Link href={`/tiendas/${storeSlug}`} className="inline-flex min-h-10 items-center text-pine underline underline-offset-4">Ver mi tienda</Link>
              <ShareLinkButton path={`/tiendas/${storeSlug}`} title={storeName} text={`Mira mi closet ${storeName} en Closets Monterrey`} label="Compartir mi tienda" />
            </div>
          )}
        </div>
        <Link href="/panel/prendas/nueva" className={`${PRIMARY_BUTTON_CLASS} shrink-0`}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Subir prenda
        </Link>
      </section>

      <section aria-labelledby="summary-title">
        <h2 id="summary-title" className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Resumen</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Disponibles" value={stats.available} href="/panel/prendas" />
          <StatCard label="Apartadas" value={stats.reserved} href="/panel/apartados" />
          <StatCard label="Vendidas" value={stats.sold} href="/panel/prendas" />
          <StatCard label="Apartados por confirmar" value={stats.toConfirm} href="/panel/apartados" highlight />
          <StatCard label="Comprobantes por revisar" value={stats.proofsToReview} href="/panel/apartados" highlight />
          {isAdmin && <StatCard label="Vendedoras por aprobar" value={stats.pendingSellers} href="/panel/admin/vendedoras" highlight />}
          {isAdmin && <StatCard label="Recolectoras por aprobar" value={stats.pendingCouriers} href="/panel/admin/recolectoras" highlight />}
          {isAdmin && <StatCard label="Soporte por atender" value={stats.openSupport} href="/panel/admin/soporte" highlight />}
        </div>
      </section>

      <PanelGroup title="Mi tienda" id="group-store">
        <PanelCard href="/panel/prendas/nueva" title="Subir prenda" description="Fotos, talla, precio y entrega." />
        <PanelCard href="/panel/prendas" title="Mis prendas" description="Edita, marca vendida o retira tus prendas." />
        <PanelCard href="/panel/apartados" title="Apartados" description="Revisa comprobantes, confirma anticipos y entregas." />
        <PanelCard href="/panel/tienda" title="Editar tienda" description="Nombre, foto, contacto y cómo te pagan." />
      </PanelGroup>

      {isAdmin && (
        <PanelGroup title="Administración del sitio" id="group-admin">
          <PanelCard href="/panel/admin/vendedoras" title="Vendedoras" description="Aprueba o suspende cuentas de vendedora." />
          <PanelCard href="/panel/admin/clientas" title="Clientas" description="Cuentas de compradoras." />
          <PanelCard href="/panel/admin/recolectoras" title="Recolectoras" description="Verifica recolectoras y sus rutas." />
          <PanelCard href="/panel/admin/prendas" title="Todas las prendas" description="Modera las prendas de todas las tiendas." />
          <PanelCard href="/panel/admin/soporte" title="Soporte" description="Clientas que piden ayuda y comprobantes sin revisar." />
        </PanelGroup>
      )}
    </div>
  );
}

function StatCard({ label, value, href, highlight = false }: { label: string; value: Count; href: string; highlight?: boolean }) {
  const needsAttention = highlight && typeof value === "number" && value > 0;
  return (
    <Link href={href} className={`flex min-h-24 flex-col justify-between border bg-white p-4 transition-colors hover:border-stone-500 ${needsAttention ? "border-pine" : "border-stone-200"}`}>
      <span className="text-xs leading-4 text-stone-600">{label}</span>
      <span className={`mt-2 font-serif text-3xl tabular-nums ${needsAttention ? "text-pine" : "text-stone-900"}`} title={value === null ? "No pudimos cargar este dato" : undefined}>
        {value === null ? "—" : value}
      </span>
    </Link>
  );
}

function PanelGroup({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-[10px] uppercase tracking-[0.22em] text-stone-500">{title}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function PanelCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="group flex min-h-24 flex-col border border-stone-200 bg-white p-4 transition-colors hover:border-stone-500">
      <span className="font-condensed text-lg font-bold uppercase text-stone-900 group-hover:text-pine">{title}</span>
      <span className="mt-1 text-sm leading-5 text-stone-600">{description}</span>
    </Link>
  );
}
