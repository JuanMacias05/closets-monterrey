import type { ReactNode } from "react";
import { StoreHeader } from "@/components/store/store-header";
import { requireCourier } from "@/features/couriers/require-courier";

// The courier's area keeps the store's look: the green "PANEL ▾" bar (column "Tus entregas") is
// its navigation, with the requests-waiting badge.
export default async function CourierLayout({ children }: { children: ReactNode }) {
  const { courier, supabase } = await requireCourier("/recolectora");
  // Expire stale requests first, so the badge never counts one she can no longer answer.
  await supabase.rpc("release_expired_reservations");

  return (
    <>
      <StoreHeader />
      <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-16 pt-6 sm:px-8 sm:pt-10">
        {courier.status === "pending" && (
          <p role="status" className="mb-6 border border-amber-700 bg-amber-50 p-4 text-sm text-stone-800">Tu cuenta está en revisión. La administración te verificará en persona; mientras tanto, llena tu ruta para aparecer en cuanto te aprueben.</p>
        )}
        {courier.status === "suspended" && (
          <p role="alert" className="mb-6 border border-[#a3261b] p-4 text-sm text-[#a3261b]">Tu cuenta está suspendida. Comunícate con la administración.</p>
        )}
        {children}
      </main>
    </>
  );
}
