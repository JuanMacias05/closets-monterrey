"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { LiveSearchResponse } from "@/features/search/search-data";
import { isLiveSearchable, MAX_SEARCH_QUERY_LENGTH, mergePopularTerms, searchResultsHref } from "@/features/search/search-query";

// Header search: a "Buscar" trigger (desktop nav, phone header, phone menu) opens one panel
// that slides down under the header with live results while typing. Enter or "Ver todo" opens
// the catalog filtered by ?q=, which is the real results page with the usual filters.
// One provider owns the open state so every trigger drives the same panel.

type CloseOptions = { restoreFocus?: boolean };
type StoreSearchContextValue = {
  isOpen: boolean;
  open: (trigger?: HTMLElement | null) => void;
  close: (options?: CloseOptions) => void;
};

const StoreSearchContext = createContext<StoreSearchContextValue | null>(null);

export function StoreSearchProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const open = useCallback((trigger?: HTMLElement | null) => {
    triggerRef.current = trigger ?? null;
    setIsOpen(true);
  }, []);

  const close = useCallback(({ restoreFocus = true }: CloseOptions = {}) => {
    setIsOpen(false);
    // Back to the button that opened it, unless the shopper is leaving for a result (or the
    // trigger lived in the phone menu, which is gone by now).
    if (restoreFocus && triggerRef.current?.isConnected) triggerRef.current.focus();
  }, []);

  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);
  return <StoreSearchContext.Provider value={value}>{children}</StoreSearchContext.Provider>;
}

export function useStoreSearch(): StoreSearchContextValue | null {
  return useContext(StoreSearchContext);
}

function SearchIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  );
}

export function StoreSearchTrigger({ variant }: { variant: "desktop" | "mobile" }) {
  const search = useStoreSearch();
  if (!search) return null;

  if (variant === "mobile") {
    return (
      <button type="button" aria-label="Buscar" aria-expanded={search.isOpen} aria-controls="store-search" onClick={(event) => search.open(event.currentTarget)} className="press grid size-11 place-items-center lg:hidden">
        <SearchIcon size={22} />
      </button>
    );
  }

  return (
    <button type="button" aria-expanded={search.isOpen} aria-controls="store-search" onClick={(event) => search.open(event.currentTarget)} className="press flex min-h-11 items-center gap-1.5 font-condensed font-bold uppercase hover:text-stone-600">
      <SearchIcon size={18} />
      <span className="link-underline">Buscar</span>
    </button>
  );
}

// Rendered inside the <header> (position: relative) so it hangs right under it, full width.
export function StoreSearchPanel() {
  const search = useStoreSearch();
  if (!search) return null;
  return <AnimatePresence>{search.isOpen && <SearchPanelContent onClose={search.close} />}</AnimatePresence>;
}

function recordSearch(term: string) {
  // keepalive lets the count finish while the page navigates away.
  fetch("/api/buscar/terminos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ term }), keepalive: true }).catch(() => {});
}

function SearchPanelContent({ onClose }: { onClose: (options?: CloseOptions) => void }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<LiveSearchResponse | null>(null);
  // The curated list shows until the real one arrives, so the chips never pop in late.
  const [popular, setPopular] = useState<string[]>(() => mergePopularTerms([]));
  const searchable = isLiveSearchable(query);
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const };

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
    // The page behind the panel must not scroll under the finger on a phone.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/buscar/terminos", { signal: controller.signal })
      .then((result) => (result.ok ? result.json() : null))
      .then((data: { terms?: unknown } | null) => {
        if (Array.isArray(data?.terms) && data.terms.length > 0) setPopular(data.terms.filter((term): term is string => typeof term === "string"));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!searchable) return;
    const controller = new AbortController();
    // Waits for a pause in typing; each keystroke cancels the request before it.
    const timer = window.setTimeout(async () => {
      try {
        const result = await fetch(`/api/buscar?${new URLSearchParams({ q: query })}`, { signal: controller.signal });
        const data = result.ok ? ((await result.json()) as LiveSearchResponse) : null;
        setResponse(data ? { ...data, query } : { query, results: [], total: 0, error: true });
      } catch {
        if (!controller.signal.aborted) setResponse({ query, results: [], total: 0, error: true });
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, searchable]);

  const current = searchable && response?.query === query ? response : null;
  // While the next answer is on its way the previous results stay, dimmed, instead of the
  // list blinking empty on every keystroke.
  const shown = searchable ? (current ?? response) : null;
  const stale = shown !== null && shown !== current;

  function leaveFor(term: string) {
    recordSearch(term);
    onClose({ restoreFocus: false });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!searchable) return;
    leaveFor(query);
    router.push(searchResultsHref(query));
  }

  return (
    <>
      {/* Behind the header (negative z inside its stacking context) but over the page. */}
      <motion.div aria-hidden="true" className="fixed inset-0 -z-10 bg-stone-900/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition} onClick={() => onClose()} />
      <motion.div
        id="store-search"
        role="dialog"
        aria-label="Buscar prendas"
        className="absolute inset-x-0 top-full border-b border-stone-200 bg-white font-sans text-base font-normal normal-case tracking-normal text-stone-900 shadow-[0_24px_40px_-24px_rgba(0,0,0,0.35)]"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -16 }}
        transition={transition}
      >
        <div className="mx-auto max-h-[calc(100dvh-5rem)] w-full max-w-5xl overflow-y-auto px-4 pb-6 pt-4 sm:px-8 sm:pb-10 sm:pt-8">
          <form role="search" onSubmit={onSubmit} className="flex items-center gap-3 border-b-2 border-stone-900 pb-1">
            <span className="text-stone-500"><SearchIcon size={24} /></span>
            <label htmlFor="store-search-input" className="sr-only">Buscar prendas</label>
            <input
              ref={inputRef}
              id="store-search-input"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              maxLength={MAX_SEARCH_QUERY_LENGTH}
              placeholder="¿Qué estás buscando?"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-12 w-full min-w-0 bg-transparent font-serif text-2xl tracking-tight text-stone-900 outline-none placeholder:text-stone-400 sm:min-h-16 sm:text-4xl [&::-webkit-search-cancel-button]:hidden"
            />
            <button type="button" onClick={() => onClose()} className="press min-h-11 shrink-0 px-1 font-condensed text-base font-bold uppercase text-stone-600 hover:text-stone-900">Cancelar</button>
          </form>

          {query.trim() === "" && (
            <section aria-labelledby="store-search-popular" className="mt-6">
              <h2 id="store-search-popular" className="font-condensed text-sm font-bold uppercase tracking-[0.06em] text-stone-500">Lo más buscado</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {popular.map((term) => (
                  <li key={term}>
                    <button type="button" onClick={() => { setQuery(term); inputRef.current?.focus(); }} className="press min-h-11 rounded-full border border-stone-300 px-4 text-sm text-stone-800 transition-colors hover:border-stone-900">
                      {term}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div aria-live="polite" className="mt-4">
            {shown && shown.results.length > 0 && (
              <div className={`transition-opacity duration-150 ${stale ? "opacity-60" : ""}`}>
                <p className="text-xs text-stone-500">{shown.total === 1 ? "1 prenda" : `${shown.total} prendas`}</p>
                <ul aria-label="Resultados" className="mt-1 grid gap-x-8 sm:grid-cols-2">
                  {shown.results.map((result) => (
                    <li key={result.id} className="border-b border-stone-100">
                      <Link href={`/prendas/${result.slug}`} onClick={() => leaveFor(query)} className="group flex items-center gap-4 py-3">
                        <span className="relative h-20 w-15 shrink-0 overflow-hidden bg-stone-100">
                          {result.image && <Image src={result.image.url} alt="" fill sizes="60px" className="object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-stone-900 underline-offset-4 group-hover:underline">{result.name}</span>
                          <span className="mt-0.5 block truncate text-xs text-stone-500">{result.storeName} · Talla {result.size}</span>
                          {result.saleStatus !== "available" && <span className="mt-1 inline-block font-condensed text-xs font-bold uppercase tracking-[0.06em] text-pine">{result.saleStatus === "sold" ? "Vendida" : "Apartada"}</span>}
                        </span>
                        <span className="shrink-0 text-sm tracking-wide text-stone-900">{result.price}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href={searchResultsHref(query)} onClick={() => leaveFor(query)} className="press mt-5 inline-flex min-h-11 items-center gap-2 border-b-2 border-pine font-condensed text-base font-bold uppercase text-pine">
                  Ver todo ({shown.total})
                </Link>
              </div>
            )}
            {current && !current.error && current.results.length === 0 && (
              <p className="py-6 text-sm text-stone-600">No encontramos prendas con esa búsqueda. Prueba con otra palabra o una talla.</p>
            )}
            {current?.error && <p role="alert" className="py-6 text-sm text-stone-600">No pudimos buscar en este momento. Intenta de nuevo.</p>}
          </div>
        </div>
      </motion.div>
    </>
  );
}
