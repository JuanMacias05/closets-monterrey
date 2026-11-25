import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { StoreHeader } from "@/components/store/store-header";
import { getViewer } from "@/features/viewer/get-viewer";

// The panel keeps the store's look (accounts and menu proposal, approved 2026-11-21): the store
// header with its green "PANEL ▾" bar is the navigation, so there is no separate panel frame or
// side menu any more. It opens to an approved seller or an admin; each admin page checks admin
// again on its own, and the database checks everything a third time.
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  if (viewer.kind === "guest") redirect("/login");

  const seller = viewer.seller?.status ?? null;
  const allowed = seller === "approved" || viewer.admin;

  return (
    <>
      <StoreHeader />
      <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-16 pt-6 sm:px-8 sm:pt-10">
        {allowed ? children : seller === "pending" ? (
          <PanelAccessState title="Tu cuenta está en revisión." message="Te avisaremos cuando la administración apruebe tu bazar. Mientras tanto puedes comprar como siempre." />
        ) : seller === "suspended" ? (
          <PanelAccessState title="Tu cuenta está suspendida." message="Comunícate con la administración si necesitas ayuda." />
        ) : (
          <PanelAccessState title="No tienes acceso al panel." message="Para vender, pídelo desde Mi cuenta › Quiero vender." />
        )}
      </main>
    </>
  );
}

function PanelAccessState({ title, message }: { title: string; message: string }) {
  return (
    <section className="mx-auto max-w-lg border border-stone-200 bg-white px-6 py-10 text-center sm:px-10">
      <h1 className="font-serif text-3xl text-stone-900">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-stone-600">{message}</p>
    </section>
  );
}
