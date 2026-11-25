import { sellerRatingLabel, type SellerRating } from "@/features/sellers/seller-rating-label";

export function SellerRatingBadge({ rating, className = "" }: { rating: SellerRating; className?: string }) {
  const label = sellerRatingLabel(rating);
  return (
    <span data-testid="seller-rating" className={`text-sm text-stone-700 ${className}`}>
      <span aria-hidden="true">{label.text}</span>
      <span className="sr-only">{label.accessible}</span>
    </span>
  );
}
