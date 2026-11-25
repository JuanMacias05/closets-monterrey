"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createProduct, deleteProductImage, deleteProductWithImages, registerProductImage, reorderProductImages, updateProduct } from "@/app/panel/prendas/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildProductImageStoragePath, prepareProductImage } from "@/features/products/product-image-upload";
import { PRIMARY_BUTTON_CLASS } from "@/components/panel/panel-styles";
import { categoriesFor, isCategoryAllowed } from "@/features/products/section-categories";
import { PRODUCT_AUDIENCES, PRODUCT_CONDITIONS, PRODUCT_SIZES, type ProductAudience, type ProductCondition } from "@/features/products/types";

export type EditableProduct = {
  id: string;
  name: string;
  description: string;
  category: string;
  audience: string;
  size: string;
  condition: ProductCondition;
  price_mxn: number;
  measurements: Record<string, number>;
  sale_status: string;
  images: ProductEditorImage[];
};

type ProductEditorImage = {
  id: string;
  storage_path: string;
  alt_text: string;
  position: number;
  width: number | null;
  height: number | null;
  url: string;
};

const measurementFields = [
  ["busto_cm", "Busto (cm)"], ["cintura_cm", "Cintura (cm)"],
  ["cadera_cm", "Cadera (cm)"], ["largo_cm", "Largo (cm)"],
] as const;

export function ProductEditor({ sellerId, product }: { sellerId: string; product: EditableProduct | null }) {
  const router = useRouter();
  const [productId, setProductId] = useState(product?.id ?? null);
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [category, setCategory] = useState(product?.category ?? "tops");
  const [audience, setAudience] = useState(product?.audience ?? "women");

  // Changing "Para" relabels the categories; one that doesn't exist there (Vestidos under
  // Hombre) is cleared so she picks again instead of saving something the server refuses.
  function changeAudience(next: string) {
    setAudience(next);
    if (!isCategoryAllowed(category, next as ProductAudience)) setCategory("");
  }
  const [size, setSize] = useState(product?.size ?? "M");
  const [condition, setCondition] = useState(product?.condition ?? "like_new");
  const [price, setPrice] = useState(product ? (product.price_mxn / 100).toFixed(2) : "");
  const [measurements, setMeasurements] = useState<Record<string, number>>(product?.measurements ?? {});
  const [images, setImages] = useState<ProductEditorImage[]>(product?.images ?? []);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // A new garment has no id yet, so its photos can't be stored. They wait here (with a local
  // preview) and go up right after the garment is created, so the seller picks photos and
  // details on one screen instead of saving first and finding the photo step afterwards.
  const [pendingPhotos, setPendingPhotos] = useState<{ file: File; previewUrl: string }[]>([]);
  const pendingRef = useRef(pendingPhotos);
  useEffect(() => { pendingRef.current = pendingPhotos; }, [pendingPhotos]);
  useEffect(() => () => pendingRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl)), []);

  function addPendingPhotos(files: FileList | null) {
    if (!files?.length) return;
    const added = Array.from(files).map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setPendingPhotos((current) => [...current, ...added]);
  }

  function removePendingPhoto(index: number) {
    setPendingPhotos((current) => {
      URL.revokeObjectURL(current[index].previewUrl);
      return current.filter((_, position) => position !== index);
    });
  }

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const normalizedPrice = price.trim().replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(normalizedPrice)) {
      setError("Escribe un precio válido, por ejemplo 350.00.");
      return;
    }
    const priceInCents = Math.round(Number(normalizedPrice) * 100);
    setSaving(true);
    const values = { name, description, category, audience, size, condition, price_mxn: priceInCents, measurements };
    const result = productId ? await updateProduct(productId, values) : await createProduct(values);
    if (!result.ok) setError(result.error);
    else if ("productId" in result) {
      const createdProductId = result.productId;
      if (typeof createdProductId !== "string" || createdProductId.length === 0) {
        setError("La prenda se creó, pero no pudimos abrir su ficha. Actualiza la página.");
      } else {
        setProductId(createdProductId);
        const photos = pendingPhotos.map((photo) => photo.file);
        const uploadError = photos.length ? await uploadFiles(photos, createdProductId) : null;
        if (uploadError) {
          // The garment exists (as a draft) and its photo section now works in edit mode, so the
          // seller can retry from here instead of starting over.
          setError(`Tu prenda se guardó como borrador, pero ${uploadError.charAt(0).toLowerCase()}${uploadError.slice(1)}`);
          setPendingPhotos([]);
          setSaving(false);
          return;
        }
        router.replace(`/panel/prendas/${createdProductId}`);
        router.refresh();
        return;
      }
    } else {
      setNotice("Cambios guardados.");
      router.refresh();
    }
    setSaving(false);
  }

  async function uploadImages(files: FileList | null) {
    if (!files?.length || !productId) return;
    setError(null);
    setNotice(null);
    const uploadError = await uploadFiles(Array.from(files), productId);
    if (uploadError) setError(uploadError);
    else {
      setNotice("Fotos agregadas.");
      router.refresh();
    }
  }

  // Uploads each file and registers it on the garment. Returns the error to show, or null.
  async function uploadFiles(files: File[], targetProductId: string): Promise<string | null> {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return "Supabase no está configurado.";
    const productId = targetProductId;
    setUploading(true);
    try {
      for (const originalFile of files) {
        const prepared = await prepareProductImage(originalFile);
        const storagePath = buildProductImageStoragePath(sellerId, productId);
        const { error: uploadError } = await supabase.storage.from("product-images")
          .upload(storagePath, prepared.file, { contentType: "image/jpeg", upsert: false });
        if (uploadError) throw new Error("No pudimos subir una foto. Revisa tu conexión e inténtalo de nuevo.");
        const result = await registerProductImage({
          productId, storagePath, altText: `${name}, foto`, width: prepared.width, height: prepared.height,
        });
        if (!result.ok || !result.imageId) {
          const { error: removeError } = await supabase.storage.from("product-images").remove([storagePath]);
          if (removeError) console.error("No se pudo limpiar un archivo de foto sin registro.", removeError);
          throw new Error(result.ok ? "No pudimos guardar los datos de la foto." : result.error);
        }
        const { data: publicData } = supabase.storage.from("product-images").getPublicUrl(storagePath);
        setImages((current) => [...current, {
          id: result.imageId!, storage_path: storagePath, alt_text: `${name}, foto`,
          position: current.length, width: prepared.width, height: prepared.height, url: publicData.publicUrl,
        }]);
      }
      return null;
    } catch (cause) {
      return cause instanceof Error ? cause.message : "No pudimos procesar las fotos.";
    } finally {
      setUploading(false);
    }
  }

  async function moveImage(from: number, to: number) {
    if (!productId || to < 0 || to >= images.length) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const result = await reorderProductImages(productId, next.map((image) => image.id));
    if (!result.ok) { setError(result.error); return; }
    setImages(next.map((image, position) => ({ ...image, position })));
    setError(null);
  }

  async function removeImage(imageId: string) {
    const result = await deleteProductImage(imageId);
    if (!result.ok) { setError(result.error); return; }
    setImages((current) => current.filter((image) => image.id !== imageId).map((image, position) => ({ ...image, position })));
    setError(null);
  }

  async function removeProduct() {
    if (!productId || !window.confirm("¿Borrar esta prenda y sus fotos? Esta acción no se puede deshacer.")) return;
    setSaving(true);
    const result = await deleteProductWithImages(productId);
    if (!result.ok) { setError(result.error); setSaving(false); return; }
    router.push("/panel/prendas");
    router.refresh();
  }

  const label = "block text-xs uppercase tracking-[0.14em] text-stone-600";
  const field = "mt-2 min-h-12 w-full border-b border-stone-400 bg-transparent px-1 text-base outline-none focus:border-stone-900";
  const isNew = !productId;
  const photoCount = isNew ? pendingPhotos.length : images.length;
  const submitLabel = saving
    ? (uploading ? "Subiendo fotos…" : "Guardando…")
    : !isNew ? "Guardar cambios" : pendingPhotos.length ? "Publicar prenda" : "Guardar como borrador";

  return (
    <div className="space-y-10">
      {/* Photos come first: they're what sells the garment, and a garment without one stays a
          draft. Before this section sat below the form and only appeared after saving. */}
      <section aria-labelledby="product-photos-title">
        <h2 id="product-photos-title" className="font-serif text-2xl">Fotos</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">La primera será la principal; puedes cambiar el orden cuando quieras.</p>
        {/* Mirrors the server rule: a garment is public only while it has at least one photo. */}
        {isNew
          ? (pendingPhotos.length === 0 && <p className="mt-3 text-sm text-stone-600">Sin fotos tu prenda se guarda como borrador y no aparece en la tienda.</p>)
          : images.length === 0
            ? <p role="status" className="mt-3 border border-amber-700 bg-amber-50 p-3 text-sm text-stone-800">Borrador: tu prenda se publica en cuanto le subas al menos una foto.</p>
            : <p className="mt-3 text-sm text-green-800">Publicada en el catálogo.</p>}
        <label htmlFor="product-photos" className="mt-5 flex min-h-14 cursor-pointer items-center justify-center border border-dashed border-stone-400 bg-white px-4 text-center text-xs uppercase tracking-[0.12em] text-stone-700 hover:border-stone-700">
          {uploading ? "Procesando y subiendo fotos…" : photoCount ? "Agregar más fotos" : "Elegir fotos desde el teléfono"}
        </label>
        <input id="product-photos" type="file" accept="image/*" multiple disabled={uploading || saving} onChange={(event) => {
          if (isNew) addPendingPhotos(event.target.files);
          else void uploadImages(event.target.files);
          event.target.value = "";
        }} className="sr-only" />
        {isNew && pendingPhotos.length > 0 && <ol className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {pendingPhotos.map((photo, index) => <li key={photo.previewUrl} className="min-w-0 border border-stone-200 bg-white p-2">
            <div className="relative aspect-[3/4] overflow-hidden bg-stone-100">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local blob: preview, nothing for next/image to optimize */}
              <img src={photo.previewUrl} alt={`Foto ${index + 1} por subir`} className="absolute inset-0 size-full object-cover" />
              {index === 0 && <span className="absolute left-2 top-2 bg-stone-900 px-2 py-1 text-[9px] uppercase tracking-wider text-white">Principal</span>}
            </div>
            <button type="button" onClick={() => removePendingPhoto(index)} disabled={saving} className="mt-2 min-h-9 w-full border border-stone-300 px-2 text-[10px] uppercase tracking-wide text-red-800">Quitar</button>
          </li>)}
        </ol>}
        {!isNew && images.length > 0 && <ol className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image, index) => <li key={image.id} className="min-w-0 border border-stone-200 bg-white p-2">
            <div className="relative aspect-[3/4] overflow-hidden bg-stone-100">
              <Image src={image.url} alt={image.alt_text || name} fill sizes="(max-width: 639px) 45vw, 200px" unoptimized className="object-cover" />
              {index === 0 && <span className="absolute left-2 top-2 bg-stone-900 px-2 py-1 text-[9px] uppercase tracking-wider text-white">Principal</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {index > 0 && <button type="button" onClick={() => void moveImage(index, 0)} className="min-h-9 flex-1 border border-stone-300 px-2 text-[10px] uppercase tracking-wide">Hacer principal</button>}
              {index > 0 && <button type="button" aria-label={`Subir foto ${index + 1}`} onClick={() => void moveImage(index, index - 1)} className="min-h-9 border border-stone-300 px-3 text-sm">↑</button>}
              {index < images.length - 1 && <button type="button" aria-label={`Bajar foto ${index + 1}`} onClick={() => void moveImage(index, index + 1)} className="min-h-9 border border-stone-300 px-3 text-sm">↓</button>}
              <button type="button" onClick={() => void removeImage(image.id)} className="min-h-9 flex-1 border border-stone-300 px-2 text-[10px] uppercase tracking-wide text-red-800">Borrar</button>
            </div>
          </li>)}
        </ol>}
      </section>

      <form onSubmit={saveDetails} aria-label="Datos de la prenda" className="space-y-6 border-t border-stone-200 pt-7">
        <div>
          <label htmlFor="product-name" className={label}>Nombre</label>
          <input id="product-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required placeholder="Ej. Blusa de lino blanca" className={field} />
        </div>
        <div>
          <label htmlFor="product-description" className={label}>Descripción</label>
          <textarea id="product-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} rows={4} placeholder="Tela, cómo le queda, si tiene algún detalle…" className="mt-2 w-full border border-stone-300 bg-white p-3 text-sm leading-6 outline-none focus:border-stone-900" />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* "Para" comes first: it decides the category words (and Hombre has no dresses). */}
          <div>
            <label htmlFor="product-audience" className={label}>Para</label>
            <select id="product-audience" value={audience} onChange={(event) => changeAudience(event.target.value)} className={field}>
              {PRODUCT_AUDIENCES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="product-category" className={label}>Categoría</label>
            <select id="product-category" value={category} onChange={(event) => setCategory(event.target.value)} required aria-describedby={category ? undefined : "product-category-hint"} className={field}>
              {!category && <option value="" disabled>Elige una categoría</option>}
              {categoriesFor(audience as ProductAudience).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            {!category && <p id="product-category-hint" role="status" className="mt-1 text-xs text-amber-800">Esa categoría no existe para {PRODUCT_AUDIENCES.find((item) => item.value === audience)?.label ?? "esta sección"}. Elige otra.</p>}
          </div>
          <div>
            <label htmlFor="product-size" className={label}>Talla</label>
            <select id="product-size" value={size} onChange={(event) => setSize(event.target.value)} className={field}>
              {PRODUCT_SIZES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="product-condition" className={label}>Condición</label>
            <select id="product-condition" value={condition} onChange={(event) => {
              const selected = PRODUCT_CONDITIONS.find((item) => item.value === event.target.value);
              if (selected) setCondition(selected.value);
            }} className={field}>
              {PRODUCT_CONDITIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="product-price" className={label}>Precio (MXN)</label>
            <div className="mt-2 flex min-h-12 items-center border-b border-stone-400 focus-within:border-stone-900">
              <span aria-hidden="true" className="pl-1 pr-1 text-base text-stone-500">$</span>
              <input id="product-price" type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required placeholder="350" className="min-h-12 w-full bg-transparent px-1 text-base outline-none" />
            </div>
          </div>
        </div>
        <fieldset>
          <legend className={label}>Medidas (opcional, cm)</legend>
          <div className="mt-3 grid grid-cols-2 gap-4">
            {measurementFields.map(([key, measurementLabel]) => (
              <label key={key} className="text-xs text-stone-600">{measurementLabel}
                <input type="number" min="0" step="0.1" value={measurements[key] ?? ""} onChange={(event) => setMeasurements((current) => {
                  const next = { ...current };
                  if (event.target.value === "") delete next[key];
                  else next[key] = Number(event.target.value);
                  return next;
                })} className="mt-1 min-h-11 w-full border-b border-stone-400 bg-transparent px-1 text-base text-stone-900 outline-none focus:border-stone-900" />
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
        <button type="submit" disabled={saving || uploading} className={`${PRIMARY_BUTTON_CLASS} w-full`}>{submitLabel}</button>
      </form>

      {productId && <div className="flex flex-col gap-4 border-t border-stone-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/prendas/${product?.id ?? productId}`} className="text-xs text-stone-600 underline underline-offset-4">Ver publicación pública</Link>
        <button type="button" onClick={() => void removeProduct()} disabled={saving} className="min-h-11 self-start text-xs uppercase tracking-[0.12em] text-red-800 underline underline-offset-4">Borrar prenda y fotos</button>
      </div>}
    </div>
  );
}
