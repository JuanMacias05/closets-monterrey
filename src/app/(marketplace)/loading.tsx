// Shown while the catalog query runs, shaped like the real page so nothing jumps when the
// products arrive. The header is drawn as plain blocks: rendering StoreHeader here would
// wait on the same auth lookup this fallback exists to cover.
export default function CatalogLoading() {
  return (
    <div aria-busy="true" aria-label="Cargando prendas" className="motion-safe:animate-pulse">
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4 sm:px-6">
        <div className="h-5 w-40 bg-stone-200" />
        <span className="font-serif text-xl tracking-tight text-stone-900 sm:text-2xl">Closets Monterrey</span>
        <div className="h-5 w-24 bg-stone-200" />
      </div>
      <div className="h-9 bg-pine-light" />

      <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-8 lg:px-12">
        <div className="flex items-end justify-between gap-4 border-b border-stone-200 pb-3 pt-6 sm:pt-8">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="h-8 w-48 bg-stone-200 sm:h-9" />
            <div className="h-4 w-64 max-w-full bg-stone-200" />
          </div>
          <div className="h-11 w-32 shrink-0 bg-stone-200" />
        </div>
        <div className="py-4"><div className="h-3 w-28 bg-stone-200" /></div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-9 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 lg:gap-x-6">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="flex flex-col gap-3">
              <div className="aspect-[3/4] bg-stone-200" />
              <div className="h-4 w-3/4 bg-stone-200" />
              <div className="h-3 w-1/3 bg-stone-200" />
              <div className="h-4 w-1/2 bg-stone-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
