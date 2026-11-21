export const RESERVATION_STATUS_LABELS: Record<string, string> = {
  pending_deposit: "Esperando anticipo",
  confirmed: "Anticipo confirmado",
  completed: "Entregada",
  expired: "Venció (sin anticipo)",
  cancelled: "Cancelado",
  no_show: "No se concretó",
};

export const TRUST_LABELS: Record<string, string> = {
  green: "Confiable",
  yellow: "Precaución",
  red: "No confiable",
  new: "Sin historial",
};

// Lightness differs, not only hue, so the light reads for color-blind sellers too.
export const TRUST_STYLES: Record<string, string> = {
  green: "bg-pine text-white",
  yellow: "bg-amber-300 text-stone-900",
  red: "bg-[#a3261b] text-white",
  new: "border border-stone-400 text-stone-700",
};

export const DELIVERY_STATUS_STEPS = [
  { value: "reserved", label: "Apartada" },
  { value: "confirmed", label: "Anticipo confirmado" },
  { value: "on_the_way", label: "En camino" },
  { value: "delivered", label: "Entregada" },
] as const;

// Proof images are deleted 15 days after delivery (migration 20261121000100); the reservation
// keeps proof_purged_at so the screens explain the missing photo instead of showing nothing.
export const PROOF_PURGED_LABEL = "Comprobante eliminado por privacidad";
