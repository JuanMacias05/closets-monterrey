import type { ReactNode } from "react";
import { PanelShell } from "@/components/panel/panel-shell";
import { unreadCount } from "@/features/chat/chat-data";
import { requireCourier } from "@/features/couriers/require-courier";
import { courierNavGroups } from "@/features/panel/panel-navigation";

// The courier's area: the panel's frame with her own menu. The request count in the menu is
// read here, and refreshed by every action that changes it (revalidatePath("/recolectora",
// "layout")): layouts are not rendered again on navigation between their pages.
export default async function CourierLayout({ children }: { children: ReactNode }) {
  const { viewer, supabase } = await requireCourier("/recolectora");
  // Expire stale requests first, so the badge never counts one she can no longer answer.
  await supabase.rpc("release_expired_reservations");
  const { count } = await supabase
    .from("courier_requests")
    .select("id", { count: "exact", head: true })
    .eq("courier_id", viewer.userId)
    .eq("status", "requested");

  return (
    <PanelShell title={viewer.fullName} homeHref="/recolectora" topLink={{ href: "/", label: "Ver tienda" }} groups={courierNavGroups(count ?? 0, await unreadCount("courier"))} showBackLink={false}>
      {viewer.status === "pending" && (
        <p role="status" className="mb-6 border border-amber-700 bg-amber-50 p-4 text-sm text-stone-800">Tu cuenta está en revisión. La administración te verificará en persona; mientras tanto, llena tu ruta para aparecer en cuanto te aprueben.</p>
      )}
      {viewer.status === "suspended" && (
        <p role="alert" className="mb-6 border border-[#a3261b] p-4 text-sm text-[#a3261b]">Tu cuenta está suspendida. Comunícate con la administración.</p>
      )}
      {children}
    </PanelShell>
  );
}
