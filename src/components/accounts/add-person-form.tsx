"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNationalMX, nationalDigitsMX } from "@/features/auth/phone-number";
import { addPerson } from "@/features/accounts/people-actions";

const label = "block text-xs uppercase tracking-[0.14em] text-stone-600";
const field = "mt-1 min-h-11 w-full border border-stone-300 bg-white px-2 text-sm";
const check = "flex min-h-11 items-center gap-2 text-sm text-stone-800";

// "+ Agregar persona" on Bazares and Verificar quién entrega: whoever an admin adds is already
// approved, and the first time she logs in with her phone she sees her tools.
export function AddPersonForm({ defaultActivity }: { defaultActivity: "sell" | "deliver" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [sell, setSell] = useState(defaultActivity === "sell");
  const [deliver, setDeliver] = useState(defaultActivity === "deliver");
  const [administer, setAdminister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await addPerson({ phone, fullName, storeName, sell, deliver, administer });
    if (result.ok) {
      setMessage({ ok: true, text: result.existed ? `Ya tenía cuenta: le agregamos lo que marcaste.` : `Listo. ${fullName.trim()} ya puede entrar con su teléfono.` });
      setPhone(""); setFullName(""); setStoreName("");
      router.refresh();
    } else {
      setMessage({ ok: false, text: result.error });
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <button type="button" onClick={() => setOpen(true)} className="min-h-11 bg-pine px-4 font-condensed text-sm font-bold uppercase text-white">+ Agregar persona</button>
        {message?.ok && <p role="status" className="text-sm text-pine">{message.text}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} aria-label="Agregar persona" className="w-full space-y-4 border border-stone-300 bg-white p-4 sm:max-w-xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="person-phone" className={label}>Teléfono</label>
          <div className="mt-1 flex min-h-11 items-center border border-stone-300 bg-white">
            <span aria-hidden="true" className="select-none px-2 text-sm text-stone-500">+52</span>
            <input id="person-phone" type="tel" inputMode="numeric" autoComplete="off" placeholder="81 0000 0000" value={formatNationalMX(phone)} onChange={(event) => setPhone(nationalDigitsMX(event.target.value))} required className="min-h-11 w-full min-w-0 bg-transparent px-1 text-sm outline-none" />
          </div>
        </div>
        <div>
          <label htmlFor="person-name" className={label}>Nombre</label>
          <input id="person-name" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={80} required placeholder="Ej. Sofía Garza" className={field} />
        </div>
      </div>
      <fieldset>
        <legend className={label}>Puede</legend>
        <div className="mt-1 flex flex-wrap gap-x-5">
          <label className={`${check} text-stone-500`}><input type="checkbox" checked disabled className="size-4 accent-pine" /> Comprar</label>
          <label className={check}><input type="checkbox" checked={sell} onChange={(event) => setSell(event.target.checked)} className="size-4 accent-pine" /> Vender</label>
          <label className={check}><input type="checkbox" checked={deliver} onChange={(event) => setDeliver(event.target.checked)} className="size-4 accent-pine" /> Entregar</label>
          <label className={check}><input type="checkbox" checked={administer} onChange={(event) => setAdminister(event.target.checked)} className="size-4 accent-pine" /> Administrar</label>
        </div>
      </fieldset>
      {sell && (
        <div>
          <label htmlFor="person-store" className={label}>Nombre de su tienda</label>
          <input id="person-store" value={storeName} onChange={(event) => setStoreName(event.target.value)} maxLength={60} placeholder="Si lo dejas vacío, usamos su nombre" className={field} />
        </div>
      )}
      <p className="text-xs text-stone-600">Queda con acceso desde ahora. Si el teléfono ya tiene cuenta, le agregamos lo que marques. Entra con un código por SMS a su teléfono.</p>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className="min-h-11 bg-pine px-4 font-condensed text-sm font-bold uppercase text-white disabled:opacity-60">{busy ? "Agregando…" : "Agregar"}</button>
        <button type="button" disabled={busy} onClick={() => { setOpen(false); setMessage(null); }} className="min-h-11 text-sm text-stone-700 underline underline-offset-4">Cancelar</button>
      </div>
      {message && <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-pine" : "text-red-700"}`}>{message.text}</p>}
    </form>
  );
}
