import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// One line under "Entregas" on the garment screens. Sellers look for store-wide settings
// there, and how buyers pay lives in "Editar tienda", so this says what's set and links to it.
export async function PaymentSettingsSummary({ sellerId }: { sellerId: string }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data: settings } = await supabase.from("seller_private_settings").select("clabe,oxxo_card").eq("seller_id", sellerId).maybeSingle();
  if (!settings) return null;

  const ways = [
    settings.clabe ? `transferencia (CLABE ••••${settings.clabe.slice(-4)})` : null,
    settings.oxxo_card ? `efectivo en OXXO (tarjeta ••••${settings.oxxo_card.slice(-4)})` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border border-stone-200 bg-white px-4 py-3 text-sm">
      <p className="min-w-0 text-stone-700">
        <span className="text-stone-500">Pagos (para todas tus prendas): </span>
        {settings.clabe
          ? ways.join(" y ")
          : <span className="font-medium text-amber-800">falta tu CLABE; sin ella nadie puede apartarte</span>}
      </p>
      <Link href="/panel/tienda" className="flex min-h-11 shrink-0 items-center text-xs uppercase tracking-[0.12em] text-stone-700 underline underline-offset-4">Cambiar</Link>
    </div>
  );
}
