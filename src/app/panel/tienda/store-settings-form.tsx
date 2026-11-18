"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { prepareProductImage } from "@/features/products/product-image-upload";
import { buildStoreAvatarStoragePath } from "@/features/store/clabe";
import { saveStoreSettings } from "@/app/panel/tienda/actions";

type Props = {
  sellerId: string;
  storeName: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  whatsapp: string;
  clabe: string;
  depositPercent: number;
  deliveryPoints: { id: string; name: string }[];
  selectedPointIds: string[];
  homeDeliveryEnabled: boolean;
  homeDeliveryFeeMxn: number;
  homeDeliveryNote: string;
};

export function StoreSettingsForm(props: Props) {
  const router = useRouter();
  const [storeName, setStoreName] = useState(props.storeName);
  const [avatarPath, setAvatarPath] = useState(props.avatarPath);
  const [avatarUrl, setAvatarUrl] = useState(props.avatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [whatsapp, setWhatsapp] = useState(props.whatsapp);
  const [clabe, setClabe] = useState(props.clabe);
  const [depositPercent, setDepositPercent] = useState(props.depositPercent);
  const [pointIds, setPointIds] = useState<string[]>(props.selectedPointIds);
  const [homeDelivery, setHomeDelivery] = useState(props.homeDeliveryEnabled);
  const [homeFee, setHomeFee] = useState(String(props.homeDeliveryFeeMxn / 100));
  const [homeNote, setHomeNote] = useState(props.homeDeliveryNote);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    let newAvatarPath: string | null = null;

    try {
      let nextAvatarPath = avatarPath;
      if (avatarFile) {
        const supabase = createSupabaseBrowserClient();
        if (!supabase) throw new Error("No está configurada la conexión con Supabase.");
        const prepared = await prepareProductImage(avatarFile);
        newAvatarPath = buildStoreAvatarStoragePath(props.sellerId);
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(newAvatarPath, prepared.file, { contentType: "image/jpeg", upsert: false });
        if (uploadError) throw new Error("No pudimos subir la foto de tu tienda.");
        nextAvatarPath = newAvatarPath;
      }

      const result = await saveStoreSettings({ storeName, avatarPath: nextAvatarPath, whatsapp, clabe, depositPercent, delivery: { pointIds, homeDelivery, homeFee, homeNote } });
      if (!result.ok) {
        if (newAvatarPath) {
          const supabase = createSupabaseBrowserClient();
          const { data, error: removeError } = await supabase?.storage.from("product-images").remove([newAvatarPath]) ?? { data: null, error: null };
          if (removeError || data?.length !== 1) console.error("No se pudo limpiar una foto de tienda que no se guardó.", removeError ?? { requested: 1, removed: data?.length ?? 0 });
        }
        setError(result.error);
        return;
      }

      setAvatarPath(nextAvatarPath);
      setAvatarUrl(nextAvatarPath ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${nextAvatarPath}` : null);
      setAvatarFile(null);
      setSaved(true);
      router.refresh();
    } catch (cause) {
      if (newAvatarPath) {
        const supabase = createSupabaseBrowserClient();
        const { data, error: removeError } = await supabase?.storage.from("product-images").remove([newAvatarPath]) ?? { data: null, error: null };
        if (removeError || data?.length !== 1) console.error("No se pudo limpiar una foto de tienda que no se guardó.", removeError ?? { requested: 1, removed: data?.length ?? 0 });
      }
      setError(cause instanceof Error ? cause.message : "No pudimos guardar la tienda.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <Image src={avatarUrl} alt={`Foto de ${storeName}`} width={80} height={80} className="size-20 rounded-full object-cover" />
        ) : (
          <div aria-label="Sin foto de tienda" className="size-20 rounded-full bg-stone-200" />
        )}
        <div className="min-w-0 flex-1">
          <label htmlFor="store-avatar" className="block text-xs uppercase tracking-[0.16em] text-stone-600">Foto de tienda</label>
          <input
            id="store-avatar"
            type="file"
            accept="image/*"
            onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm text-stone-600 file:mr-3 file:min-h-10 file:border-0 file:bg-[#eee4d8] file:px-3 file:text-xs file:uppercase file:tracking-wider"
          />
          {avatarPath && !avatarFile && (
            <button type="button" onClick={() => { setAvatarPath(null); setAvatarUrl(null); }} className="mt-2 text-xs text-stone-600 underline underline-offset-4">Quitar foto</button>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="store-name" className="block text-xs uppercase tracking-[0.16em] text-stone-600">Nombre de la tienda</label>
        <input id="store-name" value={storeName} onChange={(event) => setStoreName(event.target.value)} maxLength={80} required className="mt-2 min-h-12 w-full border-b border-stone-400 bg-transparent px-1 text-base outline-none focus:border-stone-900" />
      </div>
      <div>
        <label htmlFor="store-whatsapp" className="block text-xs uppercase tracking-[0.16em] text-stone-600">WhatsApp</label>
        <input id="store-whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="+52 81 1234 5678" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} className="mt-2 min-h-12 w-full border-b border-stone-400 bg-transparent px-1 text-base outline-none focus:border-stone-900" />
      </div>
      <div>
        <label htmlFor="store-clabe" className="block text-xs uppercase tracking-[0.16em] text-stone-600">CLABE para recibir pagos</label>
        <input id="store-clabe" inputMode="numeric" autoComplete="off" maxLength={18} value={clabe} onChange={(event) => setClabe(event.target.value.replace(/\D/g, "").slice(0, 18))} className="mt-2 min-h-12 w-full border-b border-stone-400 bg-transparent px-1 text-base tracking-widest outline-none focus:border-stone-900" />
        <p className="mt-2 text-xs leading-5 text-stone-500">Debe tener 18 dígitos y un dígito verificador válido. Sin CLABE, nadie puede apartarte prendas.</p>
      </div>
      <div>
        <label htmlFor="store-deposit" className="block text-xs uppercase tracking-[0.16em] text-stone-600">Anticipo para apartar</label>
        <select id="store-deposit" value={depositPercent} onChange={(event) => setDepositPercent(Number(event.target.value))} className="mt-2 min-h-12 w-full border-b border-stone-400 bg-transparent px-1 text-base">
          <option value={10}>10 % del total</option>
          <option value={20}>20 % del total</option>
        </select>
        <p className="mt-2 text-xs leading-5 text-stone-500">Lo que la clienta te transfiere para apartar. Tiene 24 horas; el resto se paga en la entrega.</p>
      </div>
      <fieldset>
        <legend className="block text-xs uppercase tracking-[0.16em] text-stone-600">Puntos fijos a los que llegas</legend>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {props.deliveryPoints.map((point) => (
            <label key={point.id} className="flex min-h-11 items-center gap-3 text-sm text-stone-800">
              <input type="checkbox" checked={pointIds.includes(point.id)} onChange={(event) => setPointIds((current) => event.target.checked ? [...current, point.id] : current.filter((id) => id !== point.id))} className="size-4 accent-pine" />
              {point.name}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="block text-xs uppercase tracking-[0.16em] text-stone-600">Envío a domicilio</legend>
        <label className="flex min-h-11 items-center gap-3 text-sm text-stone-800">
          <input type="checkbox" checked={homeDelivery} onChange={(event) => setHomeDelivery(event.target.checked)} className="size-4 accent-pine" />
          Ofrezco envío a domicilio
        </label>
        {homeDelivery && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="home-fee" className="block text-xs text-stone-600">Costo del envío (MXN)</label>
              <input id="home-fee" type="number" min="0" step="5" inputMode="numeric" value={homeFee} onChange={(event) => setHomeFee(event.target.value)} className="mt-1 min-h-11 w-full border-b border-stone-400 bg-transparent px-1 text-base" />
            </div>
            <div>
              <label htmlFor="home-note" className="block text-xs text-stone-600">Zonas (opcional)</label>
              <input id="home-note" value={homeNote} onChange={(event) => setHomeNote(event.target.value)} maxLength={200} placeholder="Ej. Monterrey y San Nicolás" className="mt-1 min-h-11 w-full border-b border-stone-400 bg-transparent px-1 text-base" />
            </div>
          </div>
        )}
        <p className="text-xs leading-5 text-stone-500">Si no marcas ningún punto ni envío, tus clientas acuerdan la entrega contigo por WhatsApp.</p>
      </fieldset>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {saved && <p role="status" className="text-sm text-green-800">Tienda guardada.</p>}
      <button type="submit" disabled={busy} className="min-h-12 w-full bg-stone-900 px-5 text-xs uppercase tracking-[0.18em] text-white transition-colors hover:bg-stone-700 disabled:cursor-wait disabled:opacity-60">
        {busy ? "Guardando…" : "Guardar tienda"}
      </button>
    </form>
  );
}
