import { DeliverySettingsForm } from "@/app/panel/tienda/delivery-settings-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Loads the seller's delivery options and renders the shared form. Server-side so each
// screen that shows it (store settings, new garment, edit garment) needs just one line.
export async function DeliverySettings({ sellerId }: { sellerId: string }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const [{ data: points }, { data: mine }, { data: profile }] = await Promise.all([
    supabase.from("delivery_points").select("id,name").eq("active", true).order("sort_order"),
    supabase.from("seller_delivery_points").select("point_id").eq("seller_id", sellerId),
    supabase.from("profiles").select("home_delivery_enabled,home_delivery_fee_mxn,home_delivery_note").eq("id", sellerId).maybeSingle(),
  ]);
  return (
    <DeliverySettingsForm
      points={points ?? []}
      selectedPointIds={(mine ?? []).map((row) => row.point_id)}
      homeDeliveryEnabled={profile?.home_delivery_enabled ?? false}
      homeDeliveryFeeMxn={profile?.home_delivery_fee_mxn ?? 0}
      homeDeliveryNote={profile?.home_delivery_note ?? ""}
    />
  );
}
