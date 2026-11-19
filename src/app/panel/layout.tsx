import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutFromPanel } from "@/app/panel/actions";
import { PanelBackLink } from "@/components/panel/panel-back-link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("store_name,role,status")
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

  return (
    <div className="min-h-screen bg-[#faf9f6]">
      {/* The logo truncates and the actions never shrink, so "Cerrar sesión" can't be pushed off
          the right edge on a narrow phone (it used to show as "CERR"). */}
      <header className="flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 sm:px-8 sm:py-4">
        <Link href="/panel" className="min-w-0 truncate font-serif text-lg tracking-tight text-stone-900 sm:text-xl">Closets Monterrey</Link>
        <nav aria-label="Cuenta" className="flex shrink-0 items-center gap-1 sm:gap-3">
          <Link href="/" className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-xs uppercase tracking-[0.12em] text-stone-700 underline-offset-4 hover:underline">Ver tienda</Link>
          <form action={signOutFromPanel}>
            <button type="submit" className="min-h-11 whitespace-nowrap px-2 text-xs uppercase tracking-[0.12em] text-stone-600 underline underline-offset-4">Cerrar sesión</button>
          </form>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        {/* Which store is signed in shows once, on the panel home. Repeated above every inner
            page it pushed each screen's own title down and read as a second heading. */}
        <PanelBackLink />{children}
      </main>
    </div>
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
