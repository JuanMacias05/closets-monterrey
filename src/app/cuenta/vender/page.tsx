import Link from "next/link";
import { redirect } from "next/navigation";
import { RequestActivityForm } from "@/components/accounts/request-activity-form";
import { StoreHeader } from "@/components/store/store-header";
import { getViewer } from "@/features/viewer/get-viewer";

export const metadata = { title: "Quiero vender | Closets Monterrey" };

export default async function WantToSellPage() {
  const viewer = await getViewer();
  if (viewer.kind === "guest") redirect("/login?next=/cuenta/vender");
  return (
    <>
      <StoreHeader />
      <main className="mx-auto min-h-screen w-full max-w-2xl px-4 pb-16 pt-8 sm:px-8">
        <h1 className="font-heavy text-4xl uppercase tracking-tight text-stone-900">Abre tu clóset</h1>
        {viewer.seller ? (
          <p className="mt-4 text-sm text-stone-700">Ya pediste vender. {viewer.seller.status === "approved" ? <Link href="/panel" className="text-pine underline underline-offset-4">Ir a tu clóset</Link> : "La administración está revisando tu solicitud."}</p>
        ) : (
          <>
            <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600">Sube tus prendas y véndelas en Closets. La administración revisa tu solicitud; mientras tanto puedes seguir comprando como siempre.</p>
            <RequestActivityForm activity="sell" suggestedName="" />
          </>
        )}
      </main>
    </>
  );
}
