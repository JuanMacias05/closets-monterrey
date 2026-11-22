import Link from "next/link";
import { redirect } from "next/navigation";
import { RequestActivityForm } from "@/components/accounts/request-activity-form";
import { StoreHeader } from "@/components/store/store-header";
import { getViewer } from "@/features/viewer/get-viewer";

export const metadata = { title: "Quiero entregar | Closets Monterrey" };

export default async function WantToDeliverPage() {
  const viewer = await getViewer();
  if (viewer.kind === "guest") redirect("/login?next=/cuenta/entregar");
  return (
    <>
      <StoreHeader />
      <main className="mx-auto min-h-screen w-full max-w-2xl px-4 pb-16 pt-8 sm:px-8">
        <h1 className="font-heavy text-4xl uppercase tracking-tight text-stone-900">Entrega pedidos en tu ruta</h1>
        {viewer.courier ? (
          <p className="mt-4 text-sm text-stone-700">Ya pediste entregar. <Link href="/recolectora" className="text-pine underline underline-offset-4">Ir a tus entregas</Link></p>
        ) : (
          <>
            <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600">Te citamos para revisar tu identificación en persona. Después apareces como recolectora verificada y te llegan solicitudes.</p>
            <RequestActivityForm activity="deliver" suggestedName={viewer.name === "Mi cuenta" ? "" : viewer.name} />
          </>
        )}
      </main>
    </>
  );
}
