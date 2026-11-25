"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { markStoreShared } from "@/features/sellers/share-actions";

const noopSubscribe = () => () => {};

// Garments and stores travel through Facebook groups and WhatsApp statuses, so sharing must be
// one tap. Where the browser has a share sheet (phones), one "Compartir" button opens it, and it
// already lists WhatsApp and Facebook. Elsewhere (most desktops): a WhatsApp link with the text
// and the URL, and "Copiar link". The link previews come from each page's opengraph-image.
export function ShareButton({ path, title, text, label = "Compartir", trackStoreShare = false }: {
  path: string;
  title: string;
  text: string;
  label?: string;
  // The seller sharing her own store: marks "Comparte tu bazar" done on her checklist.
  trackStoreShare?: boolean;
}) {
  const canShare = useSyncExternalStore(noopSubscribe, () => typeof navigator !== "undefined" && typeof navigator.share === "function", () => false);
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const url = origin ? new URL(path, origin).href : path;

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  function shared() {
    if (trackStoreShare) void markStoreShared();
  }

  function show(next: "copied" | "failed") {
    setStatus(next);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setStatus("idle"), 3000);
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text, url });
      shared();
    } catch (error) {
      // Closing the share sheet is a choice, not a failure.
      if (!(error instanceof DOMException && error.name === "AbortError")) await copy();
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      show("copied");
      shared();
    } catch {
      show("failed");
    }
  }

  const action = "inline-flex min-h-10 items-center border-b border-pine px-1 text-left text-xs font-medium uppercase tracking-[0.12em] text-pine";
  return (
    <span role="group" aria-label={label} className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {canShare ? (
        <button type="button" onClick={nativeShare} className={action}>{label}</button>
      ) : (
        <>
          <span aria-hidden="true" className="text-xs uppercase tracking-[0.12em] text-stone-500">{label}:</span>
          <a href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer" onClick={shared} className={action}>WhatsApp</a>
          <button type="button" onClick={copy} className={action}>Copiar link</button>
        </>
      )}
      <span role="status" className="text-xs text-stone-600">
        {status === "copied" ? "Link copiado. Pégalo en WhatsApp o Facebook." : status === "failed" ? "No pudimos copiar el link." : ""}
      </span>
    </span>
  );
}
