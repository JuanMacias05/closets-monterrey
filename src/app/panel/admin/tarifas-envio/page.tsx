import Link from "next/link";
import { redirect } from "next/navigation";
import { ZoneRatesForm } from "@/app/panel/admin/tarifas-envio/zone-rates-form";
import { MUNICIPALITIES } from "@/features/couriers/constants";
import { isKnownMunicipality } from "@/features/delivery/zone-rates";
import { isAdminUser } from "@/features/viewer/is-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Tarifas de envío | BZRS Monterrey" };

type RateRow = { origin_municipality: string; destination_municipality: string; fee_mxn: number; updated_at: string; updated_by: string | null };

const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Monterrey" });

// Home-delivery prices by zone (20261123000100). One origin at a time, picked with ?origen=.
export default async function AdminZoneRatesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const originParam = (await searchParams).origen;
  const origin = isKnownMunicipality(originParam) ? originParam : MUNICIPALITIES[0];

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await isAdminUser(supabase, user.id))) redirect("/panel");

  const { data, error } = await supabase.from("delivery_zone_rates").select("origin_municipality,destination_municipality,fee_mxn,updated_at,updated_by");
  if (error) throw new Error("No pudimos cargar las tarifas de envío.");
  const rates = (data ?? []) as RateRow[];

  // The seeded $60/$100 have no updated_by: an origin with any of them left is still to review.
  const unreviewed = new Set(rates.filter((rate) => rate.updated_by === null).map((rate) => rate.origin_municipality));
  const fromOrigin = rates.filter((rate) => rate.origin_municipality === origin);
  const feeByDestination = new Map(fromOrigin.map((rate) => [rate.destination_municipality, rate.fee_mxn]));
  const reviewedAt = fromOrigin.filter((rate) => rate.updated_by !== null).map((rate) => rate.updated_at).toSorted().at(-1);

  return (
    <section className="max-w-3xl">
      <div className="border-b border-stone-200 pb-5">
        <h1 className="font-serif text-3xl tracking-tight text-stone-900">Tarifas de envío</h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">Lo que cuesta el envío a domicilio desde el municipio de la tienda hasta el de quien compra. Quien compra lo ve como precio aproximado al apartar, y la tienda puede ajustarlo en cada apartado antes de recibir el anticipo.</p>
        {unreviewed.size > 0 && (
          <p className="mt-3 bg-amber-50 p-3 text-sm text-amber-900">
            <strong>{unreviewed.size === MUNICIPALITIES.length ? "Todas las tarifas son de ejemplo" : `${unreviewed.size} municipios tienen tarifas de ejemplo`}</strong> ($60 en el mismo municipio, $100 a otro). Cámbialas por los precios reales y guarda cada municipio de origen.
          </p>
        )}
      </div>

      <nav aria-label="Municipio de origen" className="mt-5">
        <p className="text-xs uppercase tracking-[0.14em] text-stone-600">La tienda envía desde</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {MUNICIPALITIES.map((name) => (
            <li key={name}>
              <Link
                href={`/panel/admin/tarifas-envio?origen=${encodeURIComponent(name)}`}
                aria-current={name === origin ? "page" : undefined}
                className={`inline-flex min-h-10 items-center gap-1 border px-3 text-sm ${name === origin ? "border-pine bg-pine text-white" : "border-stone-300 bg-white text-stone-700 hover:border-stone-600"}`}
              >
                {name}
                {unreviewed.has(name) && <span className={name === origin ? "text-white/80" : "text-amber-800"}> · de ejemplo</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6">
        <ZoneRatesForm
          key={origin}
          origin={origin}
          fees={MUNICIPALITIES.map((destination) => ({
            destination,
            pesos: feeByDestination.has(destination) ? String(feeByDestination.get(destination)! / 100) : "",
          }))}
        />
        <p className="mt-2 text-xs text-stone-600">
          {unreviewed.has(origin) ? "Estas tarifas todavía son de ejemplo." : reviewedAt ? `Revisadas el ${dateFormat.format(new Date(reviewedAt))}.` : null}
        </p>
      </div>
    </section>
  );
}
