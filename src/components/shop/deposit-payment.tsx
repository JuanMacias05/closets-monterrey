"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPriceMXN } from "@/features/products/format-price";
import { prepareProductImage } from "@/features/products/product-image-upload";
import { submitDepositProof } from "@/features/shop/actions";
import { formatCardNumber } from "@/features/store/card-number";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { SupportRequestForm } from "@/components/shop/support-request-form";

export type DepositProofState = {
  method: "transfer" | "oxxo" | null;
  reference: string | null;
  submittedLabel: string | null;
  rejected: boolean;
  rejectionReason: string | null;
  imageUrl: string | null;
  // Under review for longer than PROOF_REVIEW_HOURS.
  stale: boolean;
};

type Props = {
  reservationId: string;
  sellerName: string;
  depositMxn: number;
  clabe: string;
  oxxoCard: string | null;
  deadlineLabel: string;
  proof: DepositProofState;
  supportOpen: boolean;
};

const tab = "min-h-11 px-3 font-condensed text-sm font-bold uppercase";

// How the buyer pays her deposit and proves it. Two ways to pay: a transfer to the seller's
// CLABE, or cash at OXXO to the seller's card (OXXO deposits to a card number, not a CLABE),
// which is the way in for buyers without a bank app. Either way she uploads a photo of the
// receipt or ticket; while the seller reviews it, the reservation does not expire.
export function DepositPayment(props: Props) {
  const router = useRouter();
  const { proof } = props;
  const underReview = proof.submittedLabel !== null && !proof.rejected;
  const [method, setMethod] = useState<"transfer" | "oxxo">(proof.method === "oxxo" && props.oxxoCard ? "oxxo" : "transfer");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const previewRef = useRef<string | null>(null);

  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);

  function pick(next: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = next ? URL.createObjectURL(next) : null;
    previewRef.current = url;
    setPreviewUrl(url);
    setFile(next);
    setError(null);
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) { setError(method === "oxxo" ? "Elige la foto de tu ticket." : "Elige la foto o captura de tu comprobante."); return; }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError("No está configurada la conexión con Supabase."); return; }
    setBusy(true);
    setError(null);
    try {
      const prepared = await prepareProductImage(file);
      const path = `${props.reservationId}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(path, prepared.file, { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw new Error("No pudimos subir la foto. Revisa tu conexión e inténtalo de nuevo.");
      const result = await submitDepositProof(props.reservationId, path, method, reference);
      if (!result.ok) {
        await supabase.storage.from("payment-proofs").remove([path]);
        throw new Error(result.error);
      }
      pick(null);
      setReference("");
      setReplacing(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos enviar tu comprobante.");
    } finally {
      setBusy(false);
    }
  }

  const amount = formatPriceMXN(props.depositMxn);
  const proofWord = method === "oxxo" ? "ticket" : "comprobante";

  if (underReview && !replacing) {
    return (
      <div className="space-y-3">
        <div className="bg-[#e6eee9] p-4 text-sm text-pine">
          <p className="font-semibold">Enviaste tu {proof.method === "oxxo" ? "ticket de OXXO" : "comprobante"} el {proof.submittedLabel}.</p>
          <p className="mt-1">{props.sellerName} lo revisa en su banco y te avisamos aquí cuando lo confirme. Tu prenda sigue apartada mientras tanto.</p>
        </div>
        <div className="flex items-center gap-3">
          {proof.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL of a private file; next/image can't optimize it
            <img src={proof.imageUrl} alt="Tu comprobante" className="h-24 w-20 border border-stone-200 object-cover" />
          )}
          <div className="text-xs text-stone-600">
            {proof.reference && <p>{proof.method === "oxxo" ? "Folio" : "Clave de rastreo"}: <span className="font-mono text-stone-900">{proof.reference}</span></p>}
            <button type="button" onClick={() => setReplacing(true)} className="mt-1 min-h-10 text-pine underline underline-offset-4">Cambiar comprobante</button>
          </div>
        </div>
        {proof.stale && (
          <>
            <p className="bg-amber-50 p-3 text-sm text-amber-900">{props.sellerName} lleva más de 48 horas sin revisar tu comprobante. Puedes escribirle por WhatsApp o pedirnos ayuda.</p>
            <SupportRequestForm reservationId={props.reservationId} reason="proof_not_reviewed" alreadyOpen={props.supportOpen} />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {proof.rejected && (
        <div className="space-y-3">
          <p role="status" className="bg-red-50 p-3 text-sm text-red-800"><strong>{props.sellerName} no pudo confirmar tu pago:</strong> “{proof.rejectionReason}”. Revisa tu pago y sube otro comprobante.</p>
          <SupportRequestForm reservationId={props.reservationId} reason="proof_rejected" alreadyOpen={props.supportOpen} />
        </div>
      )}

      {props.oxxoCard && (
        <div role="group" aria-label="Cómo pagas el anticipo" className="grid grid-cols-2 border border-stone-300">
          <button type="button" aria-pressed={method === "transfer"} onClick={() => setMethod("transfer")} className={`${tab} ${method === "transfer" ? "bg-stone-900 text-white" : "bg-white text-stone-600"}`}>Transferencia</button>
          <button type="button" aria-pressed={method === "oxxo"} onClick={() => setMethod("oxxo")} className={`${tab} ${method === "oxxo" ? "bg-stone-900 text-white" : "bg-white text-stone-600"}`}>Efectivo en OXXO</button>
        </div>
      )}

      {method === "oxxo" && props.oxxoCard ? (
        <div className="space-y-1 bg-[#fdecef] p-4 text-sm text-stone-800">
          <p className="font-semibold">Deposita {amount} en cualquier OXXO</p>
          <p>Dile al cajero “depósito a tarjeta” y dale este número:</p>
          <p className="select-all font-mono text-lg tracking-wider text-stone-900">{formatCardNumber(props.oxxoCard)}</p>
          <p><strong>OXXO te cobra su comisión aparte</strong>, normalmente entre $15 y $17. <strong>Guarda tu ticket</strong>: le vas a tomar foto aquí abajo.</p>
        </div>
      ) : (
        <div className="space-y-1 bg-stone-100 p-4 text-sm text-stone-800">
          <p className="font-semibold">Transfiere {amount} a esta CLABE:</p>
          <p className="select-all font-mono text-lg tracking-wider text-stone-900">{props.clabe}</p>
        </div>
      )}
      <p className="text-sm text-stone-700">Si tu comprobante no llega antes del <strong>{props.deadlineLabel}</strong>, las prendas se liberan.</p>

      <form onSubmit={send} className="space-y-3 border-t border-stone-200 pt-4" aria-label="Subir comprobante">
        <p className="font-condensed text-base font-bold uppercase text-stone-900">{proof.rejected || replacing ? `Sube otro ${proofWord}` : `Ya pagaste: sube tu ${proofWord}`}</p>
        <label htmlFor={`proof-${props.reservationId}`} className="flex min-h-12 cursor-pointer items-center justify-center border border-dashed border-stone-500 bg-white px-4 text-sm text-stone-800">
          {file ? "Cambiar foto" : method === "oxxo" ? "Tomar foto del ticket" : "Elegir foto o captura del comprobante"}
        </label>
        <input id={`proof-${props.reservationId}`} type="file" accept="image/*" className="sr-only" onChange={(event) => pick(event.target.files?.[0] ?? null)} />
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- local preview from an object URL
          <img src={previewUrl} alt="Comprobante por enviar" className="mx-auto max-h-64 border border-stone-200 object-contain" />
        )}
        <div>
          <label htmlFor={`proof-ref-${props.reservationId}`} className="block text-xs uppercase tracking-[0.14em] text-stone-600">
            {method === "oxxo" ? "Folio del ticket (opcional)" : "Clave de rastreo (opcional)"}
          </label>
          <input id={`proof-ref-${props.reservationId}`} value={reference} maxLength={40} onChange={(event) => setReference(event.target.value)} autoComplete="off" className="mt-1 min-h-11 w-full border border-stone-300 bg-white px-2 font-mono text-sm" />
          <p className="mt-1 text-xs text-stone-600">{method === "oxxo" ? "Viene impreso en tu ticket." : "Viene en tu comprobante; con ella la vendedora verifica tu transferencia en Banxico."} Solo {props.sellerName} y tú ven tu comprobante.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className="min-h-12 bg-pine px-5 font-condensed text-base font-bold uppercase text-white disabled:opacity-60">{busy ? "Enviando…" : `Enviar ${proofWord}`}</button>
          {replacing && <button type="button" onClick={() => { setReplacing(false); pick(null); }} className="min-h-12 text-sm text-stone-700 underline underline-offset-4">Cancelar</button>}
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </form>
    </div>
  );
}
