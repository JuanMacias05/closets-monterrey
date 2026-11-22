import Link from "next/link";
import { CourierCard } from "@/components/couriers/courier-card";
import { StoreHeader } from "@/components/store/store-header";
import { MUNICIPALITIES } from "@/features/couriers/constants";
import { getCourierDirectory } from "@/features/couriers/directory";
import { formatPriceMXN } from "@/features/products/format-price";

export const metadata = { title: "Recolectoras verificadas | Closets Monterrey" };

export default async function CourierDirectoryPage() {
  const couriers = await getCourierDirectory();
  return (
    <>
      <StoreHeader />
      <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-16 pt-8 sm:px-8">
        <h1 className="font-heavy text-4xl uppercase tracking-tight text-stone-900 sm:text-5xl">Recolectoras verificadas</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">¿No puedes ir al punto? Una recolectora recoge tu prenda con la vendedora en el punto fijo y te la lleva a tu municipio. La eliges en tu carrito, al apartar; ella acepta la entrega (tiene 2 horas) y hasta entonces no pagas nada. Todas fueron verificadas en persona por la administración.</p>
        {couriers.length === 0 ? (
          <p className="mt-8 text-sm text-stone-600">Aún no hay recolectoras verificadas.</p>
        ) : (
          <>
            {/* Who reaches each municipality, so a buyer finds hers at a glance. */}
            <section aria-labelledby="por-municipio" className="mt-8">
              <h2 id="por-municipio" className="font-condensed text-xl font-bold uppercase text-stone-900">Por municipio</h2>
              <dl className="mt-3 divide-y divide-stone-200 border-y border-stone-200 text-sm">
                {MUNICIPALITIES.map((municipality) => {
                  const here = couriers.filter((courier) => courier.municipalities.includes(municipality));
                  return (
                    <div key={municipality} className="grid gap-1 py-2 sm:grid-cols-[14rem_1fr]">
                      <dt className="font-medium text-stone-900">{municipality}</dt>
                      <dd className="text-stone-700">
                        {here.length === 0 ? <span className="text-stone-500">Ninguna todavía</span> : here.map((courier) => (
                          `${courier.fullName} (${formatPriceMXN(courier.feeMxn)}${courier.rating !== null ? ` · ★ ${courier.rating.toFixed(1)}` : ""})`
                        )).join(" · ")}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {couriers.map((courier) => <CourierCard key={courier.id} courier={courier} />)}
            </div>
          </>
        )}
        <p className="mt-10 text-sm text-stone-600">¿Haces entregas en tu ruta? <Link href="/cuenta/entregar" className="text-pine underline underline-offset-4">Pide entregar con Closets</Link></p>
      </main>
    </>
  );
}
