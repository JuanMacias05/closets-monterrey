"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { CatalogImage } from "@/features/products/types";

const fallbackImage: CatalogImage = {
  id: "fallback",
  source: "local_placeholder",
  storage_path: "/placeholders/top-front.svg",
  alt_text: "Fotografía no disponible",
  position: 0,
  width: 900,
  height: 1100,
  url: "/placeholders/top-front.svg",
};

export function ProductGallery({ productName, images }: { productName: string; images: CatalogImage[] }) {
  const photos = images.length ? images : [fallbackImage];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const selected = photos[selectedIndex] ?? photos[0];
  const zoomButtonRef = useRef<HTMLButtonElement>(null);

  // Swipe vs tap is decided here instead of with framer's drag: on a real phone a tap always
  // moves the finger a few pixels, and framer treated that as a drag and swallowed the tap,
  // so photos never opened full screen on mobile.
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  function onPointerDown(event: React.PointerEvent) {
    pointerStart.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: React.PointerEvent) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (button && button !== zoomButtonRef.current) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (photos.length > 1 && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) moveBy(dx < 0 ? 1 : -1);
    else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) setZoomOpen(true);
  }

  function moveBy(delta: number) {
    setSelectedIndex((index) => (index + delta + photos.length) % photos.length);
  }

  useEffect(() => {
    if (!zoomOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setZoomOpen(false);
      if (event.key === "ArrowRight") setSelectedIndex((index) => (index + 1 + photos.length) % photos.length);
      if (event.key === "ArrowLeft") setSelectedIndex((index) => (index - 1 + photos.length) % photos.length);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [zoomOpen, photos.length]);

  return (
    <section aria-label="Galería de fotos" className="min-w-0">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_72px] sm:gap-4">
        <div
          data-testid="product-gallery-stage"
          className="group relative aspect-[4/5] touch-pan-y overflow-hidden bg-stone-100 select-none sm:order-2"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { pointerStart.current = null; }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.button
              ref={zoomButtonRef}
              key={selected.id}
              type="button"
              aria-label={`Ampliar foto ${selectedIndex + 1} de ${photos.length}`}
              className="absolute inset-0 size-full cursor-zoom-in"
              // Pointer taps open through onPointerUp above; this keeps Enter/Space working.
              onClick={(event) => { if (event.detail === 0) setZoomOpen(true); }}
              initial={reduceMotion ? false : { opacity: 0.45 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.28 }}
            >
              <Image
                src={selected.url}
                alt={selected.alt_text || productName}
                fill
                draggable={false}
                priority
                sizes="(max-width: 639px) 100vw, (max-width: 1023px) 75vw, 58vw"
                className="pointer-events-none object-cover transition-transform duration-700 group-hover:scale-[1.08] motion-reduce:transition-none"
              />
            </motion.button>
          </AnimatePresence>
          {photos.length > 1 && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between sm:hidden">
              <span className="bg-white/90 px-2.5 py-1 text-[10px] tracking-widest text-stone-700">{String(selectedIndex + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}</span>
              <span className="bg-white/90 px-2.5 py-1 text-[10px] uppercase tracking-widest text-stone-700">Desliza para ver</span>
            </div>
          )}
        </div>

        {photos.length > 1 && (
          <div aria-label="Elegir foto" className="order-2 flex gap-2 overflow-x-auto sm:order-1 sm:flex-col sm:overflow-visible">
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                aria-label={`Ver foto ${index + 1}`}
                aria-pressed={selectedIndex === index}
                onClick={() => setSelectedIndex(index)}
                className={`relative aspect-[4/5] w-[68px] shrink-0 overflow-hidden bg-stone-100 sm:w-full ${selectedIndex === index ? "ring-1 ring-stone-900 ring-offset-2" : "opacity-65 hover:opacity-100"}`}
              >
                <Image src={photo.url} alt="" fill draggable={false} sizes="72px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {zoomOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Foto ampliada de ${productName}`}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 sm:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
          >
            <button type="button" autoFocus onClick={() => setZoomOpen(false)} aria-label="Cerrar foto ampliada" className="absolute right-4 top-4 z-10 grid size-11 place-items-center bg-white text-xl text-stone-900">×</button>
            {photos.length > 1 && <button type="button" onClick={() => moveBy(-1)} aria-label="Foto anterior" className="absolute left-2 z-10 grid size-11 place-items-center rounded-full bg-white/90 text-2xl sm:left-6">‹</button>}
            <div
              data-testid="product-gallery-zoom-image"
              className="relative h-full max-h-[92vh] w-full max-w-5xl touch-pan-y select-none"
              onPointerDown={(event) => { pointerStart.current = { x: event.clientX, y: event.clientY }; }}
              onPointerUp={(event) => {
                const start = pointerStart.current;
                pointerStart.current = null;
                const dx = start ? event.clientX - start.x : 0;
                if (photos.length > 1 && Math.abs(dx) > 45) moveBy(dx < 0 ? 1 : -1);
              }}
            >
              <Image src={selected.url} alt={selected.alt_text || productName} fill draggable={false} sizes="100vw" className="object-contain" />
            </div>
            {photos.length > 1 && <button type="button" onClick={() => moveBy(1)} aria-label="Foto siguiente" className="absolute right-2 z-10 grid size-11 place-items-center rounded-full bg-white/90 text-2xl sm:right-6">›</button>}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
