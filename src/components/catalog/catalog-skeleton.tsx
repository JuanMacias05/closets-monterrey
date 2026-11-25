import { BrandWordmark } from "@/components/brand/brand-wordmark";
// Placeholder shapes for the store's loading.tsx files. They copy the real layout's sizes so
// nothing jumps when the content arrives, and shimmer (.skeleton in globals.css) unless the
// visitor prefers reduced motion. The header is drawn as plain blocks: rendering StoreHeader
// here would wait on the same auth lookup the fallback exists to cover.

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

export function StoreHeaderSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-4 sm:px-6">
        <SkeletonBlock className="h-5 w-40" />
        <BrandWordmark className="text-lg text-stone-900 min-[400px]:text-xl sm:text-2xl" />
        <SkeletonBlock className="h-5 w-24" />
      </div>
      <div className="h-9 bg-pine-light" />
    </>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <SkeletonBlock className="aspect-[3/4]" />
      <SkeletonBlock className="h-4 w-3/4" />
      <SkeletonBlock className="h-3 w-1/3" />
      <SkeletonBlock className="h-4 w-1/2" />
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-9 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 lg:gap-x-6">
      {Array.from({ length: count }, (_, index) => <ProductCardSkeleton key={index} />)}
    </div>
  );
}
