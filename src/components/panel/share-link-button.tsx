"use client";

import { useEffect, useRef, useState } from "react";

// Sellers sell through Facebook groups and WhatsApp statuses, so a garment or a store is only
// as useful as how easily she can paste its link there. On a phone the native share sheet
// already lists WhatsApp and Facebook; where there is none (most desktops) we copy the link.
// The URL is built from the current origin, so it follows whatever domain the site is served on.
export function ShareLinkButton({ path, title, text, label = "Compartir" }: { path: string; title: string; text: string; label?: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  function show(next: "copied" | "failed") {
    setStatus(next);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setStatus("idle"), 3000);
  }

  async function share() {
    const url = new URL(path, window.location.origin).href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        // Closing the share sheet is a choice, not a failure.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      show("copied");
    } catch {
      show("failed");
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={share} className="min-h-10 border-b border-pine px-1 text-left text-xs font-medium uppercase tracking-[0.12em] text-pine">
        {label}
      </button>
      <span role="status" className="text-xs text-stone-600">
        {status === "copied" ? "Liga copiada. Pégala en WhatsApp o Facebook." : status === "failed" ? "No pudimos copiar la liga." : ""}
      </span>
    </span>
  );
}
