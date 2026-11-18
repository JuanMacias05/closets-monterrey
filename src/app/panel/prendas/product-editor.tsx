"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createProduct, deleteProductImage, deleteProductWithImages, registerProductImage, reorderProductImages, updateProduct } from "@/app/panel/prendas/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildProductImageStoragePath, prepareProductImage } from "@/features/products/product-image-upload";
import { PRODUCT_CATEGORIES, PRODUCT_CONDITIONS, PRODUCT_SIZES, type ProductCondition } from "@/features/products/types";

export type EditableProduct = {
  id: string;
  name: string;
  description: string;
  category: string;
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
  const [size, setSize] = useState(product?.size ?? "M");
  const [condition, setCondition] = useState(product?.condition ?? "like_new");
  const [price, setPrice] = useState(product ? (product.price_mxn / 100).toFixed(2) : "");
  const [measurements, setMeasurements] = useState<Record<string, number>>(product?.measurements ?? {});
  const [images, setImages] = useState<ProductEditorImage[]>(product?.images ?? []);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    const values = { name, description, category, size, condition, price_mxn: priceInCents, measurements };
    const result = productId ? await updateProduct(productId, values) : await createProduct(values);
    if (!result.ok) setError(result.error);
    else if ("productId" in result && result.productId) {
      setProductId(result.productId);
      router.replace(`/panel/prendas/${result.productId}`);
      router.refresh();
    } else {
      setNotice("Cambios guardados.");
      router.refresh();
    }
    setSaving(false);
  }

  async function uploadImages(files: FileList | null) {
    if (!files?.length || !productId) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError("Supabase no está configurado."); return; }
    setError(null);
    setNotice(null);
    setUploading(true);
    try {
      for (const originalFile of Array.from(files)) {
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
      setNotice("Fotos agregadas.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos procesar las fotos.");
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

  return (
    <div className="space-y-10">
      <form onSubmit={saveDetails} className="space-y-6">
        <div>
          <label htmlFor="product-name" className="block text-xs uppercase tracking-[0.14em] text-stone-600">Nombre</label>
          <input id="product-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required className="mt-2 min-h-12 w-full border-b border-stone-400 bg-transparent px-1 text-base" />
        </div>
        <div>
          <label htmlFor="product-description" className="block text-xs uppercase tracking-[0.14em] text-stone-600">Descripción</label>
          <textarea id="product-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} rows={4} className="mt-2 w-full border border-stone-300 bg-white p-3 text-sm leading-6" />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="product-category" className="block text-xs uppercase tracking-[0.14em] text-stone-600">Categoría</label>
            <select id="product-category" value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 min-h-12 w-full border-b border-stone-400 bg-transparent px-1">
              {PRODUCT_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="product-size" className="block text-xs uppercase tracking-[0.14em] text-stone-600">Talla</label>
            <select id="product-size" value={size} onChange={(event) => setSize(event.target.value)} className="mt-2 min-h-12 w-full border-b border-stone-400 bg-transparent px-1">
              {PRODUCT_SIZES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="product-condition" className="block text-xs uppercase tracking-[0.14em] text-stone-600">Condición</label>
            <select id="product-condition" value={condition} onChange={(event) => setCondition(event.target.value)} className="mt-2 min-h-12 w-full border-b border-stone-400 bg-transparent px-1">
              {PRODUCT_CONDITIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="product-price" className="block text-xs uppercase tracking-[0.14em] text-stone-600">Precio (MXN)</label>
            <input id="product-price" type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required className="mt-2 min-h-12 w-full border-b border-stone-400 bg-transparent px-1" />
          </div>
        </div>
        <fieldset>
          <legend className="text-xs uppercase tracking-[0.14em] text-stone-600">Medidas (opcional, cm)</legend>
          <div className="mt-3 grid grid-cols-2 gap-4">
            {measurementFields.map(([key, label]) => (
              <label key={key} className="text-xs text-stone-600">{label}
                <input type="number" min="0" step="0.1" value={measurements[key] ?? ""} onChange={(event) => setMeasurements((current) => {
                  const next = { ...current };
                  if (event.target.value === "") delete next[key];
                  else next[key] = Number(event.target.value);
                  return next;
                })} className="mt-1 min-h-11 w-full border-b border-stone-400 bg-transparent px-1 text-base text-stone-900" />
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
        <button type="submit" disabled={saving} className="min-h-12 w-full bg-stone-900 px-5 text-xs uppercase tracking-[0.16em] text-white disabled:opacity-50">{saving ? "Guardando…" : productId ? "Guardar cambios" : "Crear prenda"}</button>
      </form>

      {productId && <section aria-labelledby="product-photos-title" className="border-t border-stone-200 pt-7">
        <h2 id="product-photos-title" className="font-serif text-2xl">Fotos</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">Agrega varias fotos. La primera será la principal; puedes cambiar el orden cuando quieras.</p>
        <label htmlFor="product-photos" className="mt-5 flex min-h-14 cursor-pointer items-center justify-center border border-dashed border-stone-400 bg-white px-4 text-center text-xs uppercase tracking-[0.12em] text-stone-700">{uploading ? "Procesando y subiendo fotos…" : "Elegir fotos desde el teléfono"}</label>
        <input id="product-photos" type="file" accept="image/*" multiple disabled={uploading} onChange={(event) => { void uploadImages(event.target.files); event.target.value = ""; }} className="sr-only" />
        {images.length > 0 && <ol className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
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
      </section>}

      {productId && <div className="flex flex-col gap-4 border-t border-stone-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/prendas/${product?.id ?? productId}`} className="text-xs text-stone-600 underline underline-offset-4">Ver publicación pública</Link>
        <button type="button" onClick={() => void removeProduct()} disabled={saving} className="min-h-11 self-start text-xs uppercase tracking-[0.12em] text-red-800 underline underline-offset-4">Borrar prenda y fotos</button>
      </div>}
    </div>
  );
}
