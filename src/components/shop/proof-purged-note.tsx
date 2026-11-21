import { PROOF_PURGED_LABEL } from "@/features/shop/reservation-labels";

const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "America/Monterrey" });

// Stands in for a deposit proof whose photo was deleted 15 days after delivery. "tile" takes the
// image's place in a layout built around the photo (admin support); "line" is a sentence under a
// reservation.
export function ProofPurgedNote({ purgedAt, variant = "line" }: { purgedAt: string; variant?: "line" | "tile" }) {
  const date = dateFormat.format(new Date(purgedAt));
  if (variant === "tile") {
    return (
      <p className="grid h-32 w-24 shrink-0 place-items-center border border-dashed border-stone-300 bg-stone-50 p-2 text-center text-[11px] leading-4 text-stone-500">
        {PROOF_PURGED_LABEL} el {date}
      </p>
    );
  }
  return <p className="mt-2 text-xs text-stone-500">{PROOF_PURGED_LABEL} el {date}, 15 días después de la entrega.</p>;
}
