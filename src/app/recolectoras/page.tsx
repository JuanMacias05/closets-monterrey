import Link from "next/link";
import { CourierCard } from "@/components/couriers/courier-card";
import { StoreHeader } from "@/components/store/store-header";
import { getCourierDirectory } from "@/features/couriers/directory";

export const metadata = { title: "Recolectoras verificadas | Closets Monterrey" };

export default async function CourierDirectoryPage() {
  const couriers = await getCourierDirectory();
  return (
    <>
      <StoreHeader />
      <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-16 pt-8 sm:px-8">
        <h1 className="font-heavy text-4xl uppercase tracking-tight text-stone-900 sm:text-5xl">Recolectoras verificadas</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">¿No puedes ir al punto? Una recolectora recoge tu prenda con la vendedora en el punto fijo y te la lleva a tu municipio. La eliges en tu carrito, al apartar. Todas fueron verificadas en persona por la administración.</p>
        {couriers.length === 0 ? (
          <p className="mt-8 text-sm text-stone-600">Aún no hay recolectoras verificadas.</p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {couriers.map((courier) => <CourierCard key={courier.id} courier={courier} />)}
          </div>
        )}
        <p className="mt-10 text-sm text-stone-600">¿Haces entregas en tu ruta? <Link href="/registro?tipo=recolectora" className="text-pine underline underline-offset-4">Regístrate como recolectora</Link></p>
      </main>
    </>
  );
}
