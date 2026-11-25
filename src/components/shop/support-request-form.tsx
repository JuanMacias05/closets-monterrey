"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestSupport, type SupportReason } from "@/features/shop/actions";
import { SUPPORT_CONTACT } from "@/features/support/support-contact";

const INTRO: Record<SupportReason, string> = {
  proof_rejected: "¿Sí pagaste? Si el dinero salió de tu cuenta o pagaste en OXXO, revisamos tu caso con la tienda.",
  proof_not_reviewed: "Te ayudamos a que revisen tu comprobante.",
  released_after_paying: "¿Ya habías pagado tu anticipo? Cuéntanos y lo revisamos con la tienda.",
  other: "Cuéntanos qué pasó con tu apartado.",
};

// The request lands in the admin panel. There is no support channel yet; once SUPPORT_CONTACT
// is filled in, the form shows it as well.
export function SupportRequestForm({ reservationId, reason, alreadyOpen }: { reservationId: string; reason: SupportReason; alreadyOpen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contact = SUPPORT_CONTACT.whatsappE164 ?? SUPPORT_CONTACT.email;

  if (alreadyOpen) {
    return <p role="status" className="bg-[#e6eee9] p-3 text-sm text-pine"><strong>Tu solicitud de ayuda está abierta.</strong> Te escribimos por WhatsApp; tu prenda sigue apartada mientras lo revisamos.</p>;
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await requestSupport(reservationId, reason, message);
    if (result.ok) router.refresh();
    else setError(result.error);
    setBusy(false);
  }

  if (!open) {
    return (
      <div className="border-t border-dashed border-stone-300 pt-3 text-sm">
        <p className="text-stone-700">{INTRO[reason]}</p>
        <button type="button" onClick={() => setOpen(true)} className="mt-2 min-h-11 border border-stone-500 px-4 font-condensed text-sm font-bold uppercase text-stone-800">Pedir ayuda</button>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="space-y-2 border-t border-dashed border-stone-300 pt-3" aria-label="Pedir ayuda">
      <label htmlFor={`support-${reservationId}`} className="block text-sm font-medium text-stone-900">Cuéntanos qué pasó</label>
      <textarea id={`support-${reservationId}`} value={message} onChange={(event) => setMessage(event.target.value)} rows={3} maxLength={1000} placeholder="Por ejemplo: deposité los $80 en OXXO a las 2 de la tarde y tengo mi ticket." className="w-full border border-stone-300 bg-white p-2 text-sm" />
      {contact && <p className="text-xs text-stone-600">También puedes escribirnos a {contact}.</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className="min-h-11 bg-stone-900 px-4 font-condensed text-sm font-bold uppercase text-white disabled:opacity-60">{busy ? "Enviando…" : "Enviar a soporte"}</button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 text-sm text-stone-700 underline underline-offset-4">Cancelar</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
