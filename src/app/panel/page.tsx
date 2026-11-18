import Link from "next/link";

export default function PanelHomePage() {
  return (
    <section className="border-y border-stone-200 py-8">
      <h1 className="font-serif text-3xl tracking-tight text-stone-900">Mi tienda</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600">Administra el perfil público y los datos de contacto de tu tienda.</p>
      <Link href="/panel/tienda" className="mt-6 inline-flex min-h-11 items-center border-b border-stone-800 px-1 text-xs uppercase tracking-[0.16em] text-stone-800">Editar tienda</Link>
    </section>
  );
}
