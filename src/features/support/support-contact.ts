// Where shoppers reach support. Empty until there is a support channel: requests still reach
// the admin panel (/panel/admin/soporte), and the admin answers on the buyer's WhatsApp. Fill
// these in when the business has its own number or email and the help forms show them too.
export const SUPPORT_CONTACT: { whatsappE164: string | null; email: string | null } = {
  whatsappE164: null,
  email: null,
};

export const SUPPORT_REASON_LABELS: Record<string, string> = {
  proof_rejected: "Le rechazaron su comprobante",
  proof_not_reviewed: "La tienda no revisa su comprobante",
  released_after_paying: "Se liberó su apartado pero ya había pagado",
  other: "Otro problema",
};

// After this long without a review, the buyer can ask for help and the admin panel flags it.
export const PROOF_REVIEW_HOURS = 48;

/** Proofs submitted before this moment (ms) have waited longer than PROOF_REVIEW_HOURS. */
export function proofReviewCutoff(now = Date.now()) {
  return now - PROOF_REVIEW_HOURS * 60 * 60 * 1000;
}
