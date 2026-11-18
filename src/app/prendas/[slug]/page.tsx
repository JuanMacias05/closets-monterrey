import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/products/product-gallery";
import { ProductCard } from "@/components/catalog/product-card";
import { getMoreFromSeller, getProductDetail } from "@/features/products/product-detail-data";
import { formatPriceMXN } from "@/features/products/format-price";
import { PRODUCT_CATEGORIES } from "@/features/products/types";

type PageProps = { params: Promise<{ slug: string }> };

const conditionLabels = { new: "Nuevo", like_new: "Como nuevo", used: "Usado" } as const;
const measurementLabels: Record<string, string> = {
  busto_cm: "Busto",
  cintura_cm: "Cintura",
  cadera_cm: "Cadera",
  largo_cm: "Largo",
  largo_pie_cm: "Largo del pie",
  tacon_cm: "Tacón",
  ancho_cm: "Ancho",
  alto_cm: "Alto",
};

function siteOrigin() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL;
  if (!site) return new URL("http://localhost:3000");
  return new URL(site.startsWith("http") ? site : `https://${site}`);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) return { title: "Prenda no encontrada | Closets Monterrey" };

  const title = `${product.name} | Closets Monterrey`;
  const description = `${formatPriceMXN(product.price_mxn)} · Talla ${product.size} · ${product.seller.store_name}`;
  const image = product.images[0];
  const imageUrl = image ? new URL(image.url, siteOrigin()).toString() : undefined;

  return {
    title,
    description,
    alternates: { canonical: `/prendas/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.name,
      description,
      url: `/prendas/${product.slug}`,
      ...(imageUrl && {
        images: [{
          url: imageUrl,
          width: image?.width ?? 900,
          height: image?.height ?? 1100,
          alt: image?.alt_text || product.name,
        }],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
      ...(imageUrl && { images: [imageUrl] }),
    },
  };
}

function Measurements({ measurements }: { measurements: Record<string, number> }) {
  const entries = Object.entries(measurements).filter(([, value]) => Number.isFinite(value));
  if (!entries.length) return null;

  return (
    <section className="border-t border-stone-200 py-5">
      <h2 className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Medidas aproximadas</h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {entries.map(([key, value]) => (
          <div key={key} className="flex justify-between gap-3 text-stone-700">
            <dt>{measurementLabels[key] ?? key.replaceAll("_", " ")}</dt>
            <dd className="tabular-nums">{value} cm</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) notFound();

  const related = await getMoreFromSeller(product.seller.slug, product.id);
  const category = PRODUCT_CATEGORIES.find((item) => item.value === product.category)?.label ?? product.category;
  const saleLabel = product.sale_status === "reserved" ? "Apartada" : product.sale_status === "sold" ? "Vendida" : null;
  const unavailable = product.sale_status !== "available";

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1600px] px-4 pb-14 sm:px-8 lg:px-12">
      <header className="flex items-center justify-between border-b border-stone-200 py-5 sm:py-7">
        <Link href="/" className="font-serif text-xl tracking-tight text-stone-900 sm:text-2xl">Closets Monterrey</Link>
        <p className="hidden text-[10px] uppercase tracking-[0.24em] text-stone-500 sm:block">Moda circular · Nuevo León</p>
        <Link href="/" className="text-[10px] uppercase tracking-[0.18em] text-stone-600 sm:text-xs">Volver al catálogo</Link>
      </header>

      <nav aria-label="Ruta de navegación" className="py-5 text-[10px] uppercase tracking-[0.16em] text-stone-400 sm:py-7">
        <Link href="/" className="hover:text-stone-800">Catálogo</Link><span className="px-2">/</span><span className="text-stone-700">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:gap-16 xl:gap-24">
        <ProductGallery productName={product.name} images={product.images} />

        <section className="lg:sticky lg:top-8 lg:h-fit lg:py-2">
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-stone-500">
            <span>{category}</span><span aria-hidden="true">·</span><span>{conditionLabels[product.condition]}</span>
          </div>
          <h1 className="mt-3 font-serif text-3xl leading-tight tracking-tight text-stone-900 sm:text-4xl">{product.name}</h1>
          <p className="mt-4 text-lg tracking-wide text-stone-900">{formatPriceMXN(product.price_mxn)}</p>

          {saleLabel && (
            <p className={`mt-6 inline-flex px-3 py-2 text-[10px] uppercase tracking-[0.18em] ${product.sale_status === "sold" ? "bg-stone-900 text-white" : "bg-[#eee4d8] text-stone-800"}`} role="status">
              {saleLabel}
            </p>
          )}

          <dl className="mt-7 grid grid-cols-2 gap-4 border-y border-stone-200 py-5 text-sm">
            <div><dt className="text-xs text-stone-500">Talla</dt><dd className="mt-1 text-stone-900">{product.size}</dd></div>
            <div><dt className="text-xs text-stone-500">Estado</dt><dd className="mt-1 text-stone-900">{conditionLabels[product.condition]}</dd></div>
          </dl>

          <Measurements measurements={product.measurements ?? {}} />

          {product.description && (
            <section className="border-t border-stone-200 py-5">
              <h2 className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Descripción</h2>
              <p className="mt-3 text-sm leading-6 text-stone-700">{product.description}</p>
            </section>
          )}

          <div className="border-t border-stone-200 pt-5">
            <div className="flex items-center gap-3">
              {product.seller.avatar_path ? (
                <Image src={product.seller.avatar_path} alt={`Foto de ${product.seller.store_name}`} width={48} height={48} className="size-12 rounded-full object-cover" />
              ) : (
                <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-stone-200 font-serif text-lg text-stone-700">{product.seller.store_name.slice(0, 1).toUpperCase()}</span>
              )}
              <span><span className="block text-[10px] uppercase tracking-[0.18em] text-stone-500">Vendido por</span><span className="mt-1 block text-sm text-stone-900">{product.seller.store_name}</span></span>
            </div>
          </div>

          <button type="button" disabled={unavailable} data-testid="buy-button" className="mt-7 min-h-14 w-full bg-stone-900 px-6 text-xs uppercase tracking-[0.2em] text-white transition-colors hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600">
            Comprar
          </button>
          {unavailable && <p className="mt-2 text-center text-xs text-stone-500">Esta prenda ya no está disponible para compra.</p>}
          <p className="mt-3 text-center text-[10px] leading-5 text-stone-400">El proceso de pago estará disponible próximamente.</p>
        </section>
      </div>

      {related.length > 0 && (
        <section className="mt-16 border-t border-stone-200 pt-10 sm:mt-24 sm:pt-14">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div><p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Explora su selección</p><h2 className="mt-2 font-serif text-2xl text-stone-900 sm:text-3xl">Más prendas de {product.seller.store_name}</h2></div>
            <span className="hidden text-xs text-stone-400 sm:block">Piezas únicas</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-9 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 lg:gap-x-6">
            {related.map((item) => <ProductCard key={item.id} product={item} />)}
          </div>
        </section>
      )}

      <footer className="mt-14 border-t border-stone-200 py-6 text-[10px] uppercase tracking-[0.18em] text-stone-500">Monterrey, Nuevo León · Moda de segunda mano</footer>
    </main>
  );
}
