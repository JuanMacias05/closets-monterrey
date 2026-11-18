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
        <div className="flex flex-col items-center gap-6 pb-10 pt-12">
          <div className="h-12 w-3/4 max-w-2xl bg-stone-200 sm:h-20" />
          <div className="h-4 w-64 bg-stone-200" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-11 w-20 bg-stone-200" />)}
          </div>
        </div>
        <div className="h-16 border-y border-stone-200" />
        <div className="grid grid-cols-2 gap-x-3 gap-y-9 pt-14 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 lg:gap-x-6">
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
