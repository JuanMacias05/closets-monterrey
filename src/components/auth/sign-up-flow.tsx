"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhoneLoginForm } from "@/components/auth/phone-login-form";
import { requestActivities } from "@/features/accounts/activity-actions";

const check = "flex gap-3 border border-stone-200 p-4 text-sm text-stone-700";

// Sign-up: name, Facebook link and phone, the SMS code, then ONE question with checkboxes
// (accounts and menu proposal). Buying is always on; selling and delivering start pending
// (request_activity, 20261127000100) until an admin approves or verifies her.
export function SignUpFlow({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"account" | "activities">("account");
  const [sell, setSell] = useState(false);
  const [deliver, setDeliver] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sell && storeName.trim().length === 0) {
      setError("Escribe el nombre de tu clóset.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await requestActivities({ sell, deliver, storeName });
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }
    router.replace(nextPath ?? (sell ? "/panel" : deliver ? "/recolectora/ruta" : "/cuenta"));
    router.refresh();
  }

  if (step === "account") {
    return (
      <>
        <p className="mt-8 text-[11px] uppercase tracking-[0.24em] text-stone-600">Paso 1 de 2</p>
        <h1 className="mt-3 font-serif text-3xl tracking-tight text-stone-900">Crea tu cuenta.</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">Te mandamos un código por SMS. Después nos dices qué quieres hacer en Closets.</p>
        <PhoneLoginForm mode="buyer-signup" nextPath={nextPath} onVerified={() => setStep("activities")} />
      </>
    );
  }

  return (
    <form onSubmit={finish} className="mt-8 space-y-4">
      <p className="text-[11px] uppercase tracking-[0.24em] text-stone-600">Paso 2 de 2</p>
      <fieldset className="space-y-3">
        <legend className="font-serif text-3xl tracking-tight text-stone-900">¿Qué quieres hacer en Closets?</legend>
        <label className={`${check} mt-4 bg-stone-50`}>
          <input type="checkbox" checked disabled className="mt-0.5 size-4 shrink-0 accent-pine" />
          <span><strong className="block text-stone-900">Comprar</strong>Todas las cuentas pueden comprar y apartar.</span>
        </label>
        <label className={check}>
          <input type="checkbox" checked={sell} onChange={(event) => setSell(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-pine" />
          <span><strong className="block text-stone-900">Vender mis prendas</strong>Abres tu clóset. La administración lo revisa antes de que puedas publicar.</span>
        </label>
        {sell && (
          <div className="pl-4">
            <label htmlFor="store-name" className="block text-xs uppercase tracking-[0.16em] text-stone-600">Nombre de tu clóset</label>
            <input id="store-name" type="text" autoComplete="organization" placeholder="El clóset de Ana" value={storeName} onChange={(event) => setStoreName(event.target.value)} maxLength={60} className="min-h-12 w-full border-b border-stone-400 bg-transparent px-1 text-base outline-none focus:border-stone-900" />
          </div>
        )}
        <label className={check}>
          <input type="checkbox" checked={deliver} onChange={(event) => setDeliver(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-pine" />
          <span><strong className="block text-stone-900">Entregar pedidos</strong>Llevas prendas en tu ruta. Te verificamos tu identificación en persona.</span>
        </label>
      </fieldset>
      <button type="submit" disabled={busy} className="min-h-12 w-full bg-pine px-5 font-condensed text-base font-bold uppercase text-white hover:bg-pine-light disabled:opacity-60">{busy ? "Creando…" : "Crear mi cuenta"}</button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
