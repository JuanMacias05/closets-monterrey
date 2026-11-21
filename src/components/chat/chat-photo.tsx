"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// A chat photo: a thumbnail in the thread that opens full size. The bucket is private, so the
// page hands over a signed URL; a photo that arrives live is signed here, with the viewer's own
// session (only participants may).
export function ChatPhoto({ path, initialUrl, senderLabel }: { path: string; initialUrl: string | null; senderLabel: string }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const url = initialUrl ?? signedUrl;

  useEffect(() => {
    if (initialUrl) return;
    let cancelled = false;
    createSupabaseBrowserClient()?.storage.from("chat-photos").createSignedUrl(path, 60 * 30).then(({ data }) => {
      if (!cancelled && data?.signedUrl) setSignedUrl(data.signedUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [path, initialUrl]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!url) return <span aria-label="Cargando foto" className="mt-0.5 block size-40 animate-pulse bg-stone-100 motion-reduce:animate-none" />;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Ver ${senderLabel.toLowerCase()} en grande`} className="mt-0.5 block">
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL of a private file */}
        <img src={url} alt={senderLabel} className="max-h-48 max-w-56 border border-stone-200 object-cover" />
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={senderLabel} className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/85 p-4" onClick={() => setOpen(false)}>
          <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Cerrar foto" className="absolute right-3 top-3 grid size-11 place-items-center text-white">
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL of a private file */}
          <img src={url} alt={senderLabel} className="max-h-full max-w-full object-contain" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </>
  );
}
