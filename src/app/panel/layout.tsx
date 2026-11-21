import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { signOutFromPanel } from "@/app/panel/actions";
import { PanelShell } from "@/components/panel/panel-shell";
import { unreadCount } from "@/features/chat/chat-data";
import { panelNavGroups } from "@/features/panel/panel-navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("store_name,slug,role,status")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (error || !profile) {
    return <PanelAccessState title="No pudimos cargar tu cuenta." message="Cierra sesión y vuelve a intentarlo." />;
  }
  if (profile.status === "pending") {
    return <PanelAccessState title="Tu cuenta está en revisión." message="Te avisaremos cuando la administración apruebe tu tienda." />;
  }
  if (profile.status === "suspended") {
    return <PanelAccessState title="Tu cuenta está suspendida." message="Comunícate con la administración si necesitas ayuda." />;
  }
  if (profile.status !== "approved" || !["seller", "admin"].includes(profile.role)) {
    return <PanelAccessState title="No tienes acceso al panel." message="Esta cuenta no tiene un rol habilitado para administrar una tienda." />;
  }

  // "Ver tienda" opens her own storefront; an account without a public slug yet gets the
  // marketplace instead of a broken link.
  const storeHref = profile.slug ? `/tiendas/${profile.slug}` : "/";
  return (
    <PanelShell
      title={profile.store_name || "Tu panel"}
      homeHref="/panel"
      topLink={{ href: storeHref, label: "Ver tienda" }}
      groups={panelNavGroups(profile.role === "admin", await unreadCount("seller"))}
    >
      {children}
    </PanelShell>
  );
}

function PanelAccessState({ title, message }: { title: string; message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf9f6] px-4 py-12">
      <section className="w-full max-w-lg border border-stone-200 bg-white px-6 py-10 text-center sm:px-10">
        <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Closets Monterrey</p>
        <h1 className="mt-4 font-serif text-3xl text-stone-900">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">{message}</p>
        <form action={signOutFromPanel}>
          <button type="submit" className="mt-7 min-h-11 border-b border-stone-700 px-2 text-xs uppercase tracking-[0.16em] text-stone-700">Cerrar sesión</button>
        </form>
      </section>
    </main>
  );
}
