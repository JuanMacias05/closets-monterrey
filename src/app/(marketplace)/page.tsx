export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-10">
      <header className="border-b border-stone-200 pb-5">
        <p className="text-xs uppercase tracking-[0.28em] text-stone-500">
          Monterrey, México
        </p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
          Closets Monterrey
        </h1>
      </header>
      <section className="flex flex-1 flex-col justify-center py-20">
        <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
          Moda circular · Fase de setup
        </p>
        <h2 className="mt-5 max-w-2xl font-serif text-4xl leading-tight tracking-tight sm:text-6xl">
          Prendas especiales, listas para una nueva historia.
        </h2>
        <p className="mt-6 max-w-xl text-base leading-7 text-stone-600">
          Estamos preparando un espacio para descubrir ropa de segunda mano de
          vendedoras locales.
        </p>
      </section>
      <footer className="border-t border-stone-200 pt-4 text-xs text-stone-500">
        Hecho en Monterrey
      </footer>
    </main>
  );
}
