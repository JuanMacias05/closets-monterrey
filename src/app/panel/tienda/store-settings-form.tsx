"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { prepareProductImage } from "@/features/products/product-image-upload";
import { formatCardNumber } from "@/features/store/card-number";
import { buildStoreAvatarStoragePath } from "@/features/store/clabe";
import { saveStoreSettings } from "@/app/panel/tienda/actions";
import { PRIMARY_BUTTON_CLASS } from "@/components/panel/panel-styles";
import { formatNationalMX } from "@/features/auth/phone-number";

// Shown with spaces (+52 81 1234 5678) instead of the stored +528112345678; saving normalizes
// it back, so the seller can read and check her own number at a glance.
function displayWhatsapp(e164: string) {
  const match = /^\+52(\d{10})$/.exec(e164);
  return match ? `+52 ${formatNationalMX(match[1])}` : e164;
}

type Props = {
  sellerId: string;
  storeName: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  whatsapp: string;
  clabe: string;
  oxxoCard: string;
  depositPercent: number;
};

export function StoreSettingsForm(props: Props) {
  const router = useRouter();
  const [storeName, setStoreName] = useState(props.storeName);
  const [avatarPath, setAvatarPath] = useState(props.avatarPath);
  const [avatarUrl, setAvatarUrl] = useState(props.avatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [whatsapp, setWhatsapp] = useState(displayWhatsapp(props.whatsapp));
  const [clabe, setClabe] = useState(props.clabe);
  const [oxxoCard, setOxxoCard] = useState(formatCardNumber(props.oxxoCard));
  const [depositPercent, setDepositPercent] = useState(props.depositPercent);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  // Local preview of a newly picked photo, so the seller sees it before saving.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);
  function pickAvatar(file: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = file ? URL.createObjectURL(file) : null;
    setPreviewUrl(previewRef.current);
    setAvatarFile(file);
  }
  const shownAvatar = previewUrl ?? avatarUrl;

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

      const result = await saveStoreSettings({ storeName, avatarPath: nextAvatarPath, whatsapp, clabe, depositPercent, oxxoCard });
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
      pickAvatar(null);
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
        {shownAvatar ? (
          // unoptimized: the photo is already resized on upload, and a blob: preview can't go
          // through the image optimizer at all.
          <Image src={shownAvatar} alt={`Foto de ${storeName}`} width={80} height={80} unoptimized className="size-20 shrink-0 rounded-full object-cover" />
        ) : (
          <div aria-label="Sin foto de tienda" className="flex size-20 shrink-0 items-center justify-center rounded-full bg-stone-200 font-serif text-2xl text-stone-500">{storeName.trim().charAt(0).toUpperCase()}</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-600">Foto de tienda</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {/* The native file input shows the browser's own text ("Choose file / No file chosen",
                often in English), so it's hidden and this label opens it. */}
            <label htmlFor="store-avatar" className="inline-flex min-h-11 cursor-pointer items-center border border-stone-400 bg-white px-4 text-xs uppercase tracking-[0.12em] text-stone-800 hover:border-stone-800">
              {shownAvatar ? "Cambiar foto" : "Elegir foto"}
            </label>
            <input id="store-avatar" type="file" accept="image/*" onChange={(event) => { pickAvatar(event.target.files?.[0] ?? null); event.target.value = ""; }} className="sr-only" />
            {avatarFile && <button type="button" onClick={() => pickAvatar(null)} className="min-h-11 text-xs text-stone-600 underline underline-offset-4">Cancelar</button>}
            {avatarPath && !avatarFile && (
              <button type="button" onClick={() => { setAvatarPath(null); setAvatarUrl(null); }} className="min-h-11 text-xs text-stone-600 underline underline-offset-4">Quitar foto</button>
            )}
          </div>
          {avatarFile && <p className="mt-1 text-xs text-stone-500">Se guarda al dar “Guardar tienda”.</p>}
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
        <label htmlFor="store-oxxo-card" className="block text-xs uppercase tracking-[0.16em] text-stone-600">Tarjeta para depósitos en OXXO (opcional)</label>
        <input id="store-oxxo-card" inputMode="numeric" autoComplete="off" placeholder="0000 0000 0000 0000" maxLength={19} value={oxxoCard} onChange={(event) => setOxxoCard(formatCardNumber(event.target.value.slice(0, 19)))} className="mt-2 min-h-12 w-full border-b border-stone-400 bg-transparent px-1 text-base tracking-widest outline-none focus:border-stone-900" />
        <p className="mt-2 text-xs leading-5 text-stone-500">Los 16 dígitos al frente de tu tarjeta de débito o de Spin by OXXO. Así te puede pagar el anticipo en efectivo quien no tiene app de banco. Antes de ponerla, confirma con tu banco que acepta depósitos en OXXO.</p>
      </div>
      <div>
        <label htmlFor="store-deposit" className="block text-xs uppercase tracking-[0.16em] text-stone-600">Anticipo para apartar</label>
        <select id="store-deposit" value={depositPercent} onChange={(event) => setDepositPercent(Number(event.target.value))} className="mt-2 min-h-12 w-full border-b border-stone-400 bg-transparent px-1 text-base">
          <option value={10}>10 % del total</option>
          <option value={20}>20 % del total</option>
        </select>
        <p className="mt-2 text-xs leading-5 text-stone-500">Lo que la clienta te transfiere para apartar. Tiene 24 horas; el resto se paga en la entrega.</p>
      </div>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {saved && <p role="status" className="text-sm text-green-800">Tienda guardada.</p>}
      <button type="submit" disabled={busy} className={`${PRIMARY_BUTTON_CLASS} w-full`}>
        {busy ? "Guardando…" : "Guardar tienda"}
      </button>
    </form>
  );
}
