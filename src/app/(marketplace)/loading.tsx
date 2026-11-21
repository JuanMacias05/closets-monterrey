import { ProductGridSkeleton, SkeletonBlock, StoreHeaderSkeleton } from "@/components/catalog/catalog-skeleton";

// Shown while the catalog query runs, shaped like the real page so nothing jumps when the
// products arrive.
export default function CatalogLoading() {
  return (
    <div aria-busy="true" aria-label="Cargando prendas">
      <StoreHeaderSkeleton />
      <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-8 lg:px-12">
        <div className="flex items-end justify-between gap-4 border-b border-stone-200 pb-3 pt-6 sm:pt-8">
          <div className="flex min-w-0 flex-col gap-2">
            <SkeletonBlock className="h-8 w-48 sm:h-9" />
            <SkeletonBlock className="h-4 w-64 max-w-full" />
          </div>
          <SkeletonBlock className="h-11 w-32 shrink-0" />
        </div>
        <div className="py-4"><SkeletonBlock className="h-3 w-28" /></div>
        <ProductGridSkeleton />
      </div>
    </div>
  );
}
