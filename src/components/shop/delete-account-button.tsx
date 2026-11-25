"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const ERROR_MESSAGES: Record<string, string> = {
  open_reservations: "Tienes un apartado abierto. Termínalo o cancélalo con la tienda antes de borrar tu cuenta.",
  needs_manual_review: "Tu cuenta tiene apartados que no se concretaron, así que el borrado lo revisamos nosotros. Pídelo desde Borrar mis datos.",
  not_a_buyer_account: "Las cuentas que venden o entregan se borran a petición. Pídelo desde Borrar mis datos.",
};

// Two steps on purpose: deleting is permanent, and the first tap only explains what goes away.
export function DeleteAccountButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError("No está configurada la conexión con Supabase."); return; }
    setBusy(true);
    setError(null);
    // Read before deleting: the account function unlinks her reservations from these files.
    const { data: proofs } = await supabase.from("reservations").select("proof_path").not("proof_path", "is", null);
    const proofPaths = (proofs ?? []).map((row) => row.proof_path as string);
    const { error: rpcError } = await supabase.rpc("delete_my_buyer_account");
    if (rpcError) {
      setError(ERROR_MESSAGES[rpcError.message] ?? "No pudimos borrar tu cuenta. Inténtalo de nuevo o pídelo desde Borrar mis datos.");
      setBusy(false);
      return;
    }
    // Her session token is still valid for a few minutes, and the storage policy lets an
    // uploader delete her own files, so the bank receipts go with the account.
    if (proofPaths.length) {
      const { error: removeError } = await supabase.storage.from("payment-proofs").remove(proofPaths);
      if (removeError) console.error("No se pudieron borrar los comprobantes de la cuenta.", removeError);
    }
    // The user no longer exists; clear the local session and leave the private area.
    await supabase.auth.signOut();
    router.replace("/?cuenta=borrada");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="min-h-11 text-sm text-red-800 underline underline-offset-4">
        Borrar mi cuenta
      </button>
    );
  }

  return (
    <div role="group" aria-labelledby="delete-account-title" className="border border-red-800 bg-white p-5">
      <p id="delete-account-title" className="font-medium text-stone-900">¿Borrar tu cuenta para siempre?</p>
      <p className="mt-2 text-sm leading-6 text-stone-700">
        Se borran tu nombre, tu link de Facebook, tu celular, tus favoritos, tu carrito y tus comprobantes de pago. Las tiendas conservan que hubo una venta, pero ya no quién la hizo ni dónde se entregó. No se puede deshacer.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error} {error.includes("Borrar mis datos") && <Link href="/borrar-datos" className="underline underline-offset-4">Ir a Borrar mis datos</Link>}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" disabled={busy} onClick={() => void deleteAccount()} className="min-h-11 bg-red-800 px-5 font-condensed text-base font-bold uppercase text-white disabled:opacity-50">
          {busy ? "Borrando…" : "Sí, borrar mi cuenta"}
        </button>
        <button type="button" disabled={busy} onClick={() => { setConfirming(false); setError(null); }} className="min-h-11 px-3 text-sm text-stone-700 underline underline-offset-4">Cancelar</button>
      </div>
    </div>
  );
}
