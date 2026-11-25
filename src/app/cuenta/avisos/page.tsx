import { redirect } from "next/navigation";
import { NotificationsToggle } from "@/components/push/notifications-toggle";
import { StoreHeader } from "@/components/store/store-header";
import { getViewer } from "@/features/viewer/get-viewer";

export const metadata = { title: "Avisos | BZRS Monterrey" };

// Push notifications for this device: new messages, apartados and deliveries.
export default async function NotificationsPage() {
  const viewer = await getViewer();
  if (viewer.kind === "guest") redirect("/login?next=/cuenta/avisos");
  return (
    <>
      <StoreHeader />
      <main className="mx-auto min-h-screen w-full max-w-2xl px-4 pb-16 pt-8 sm:px-8">
        <h1 className="font-heavy text-4xl uppercase tracking-tight text-stone-900">Avisos</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600">Te avisamos en este celular o computadora cuando te escriben, te apartan una prenda o cambia una entrega. Se activa en cada dispositivo por separado.</p>
        <div className="mt-6"><NotificationsToggle /></div>
        <noscript><p className="mt-4 text-sm text-stone-600">Necesitas JavaScript para activar los avisos.</p></noscript>
      </main>
    </>
  );
}
