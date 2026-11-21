"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { signOutFromPanel } from "@/app/panel/actions";
import { PanelBackLink } from "@/components/panel/panel-back-link";
import { PanelIcon } from "@/components/panel/panel-icons";
import { NotificationsToggle } from "@/components/push/notifications-toggle";
import {
  activePanelHref,
  readSidebarCollapsed,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  writeSidebarCollapsed,
  type PanelNavGroup,
} from "@/features/panel/panel-navigation";

// The panel's frame: a left side menu (icons + labels) on laptops, which can shrink to icons
// only, and a drawer opened from the top bar's menu button on phones. The top bar keeps only
// whose panel it is and "Ver tienda"; everything else lives in the menu. Sellers (/panel) and
// couriers (/recolectora) share it, each with her own menu.
//
// IMPORTANT: role checks stay on the server. Each layout decides which menu groups to pass
// (the admin group only for admins) and every page re-checks access; this component only draws
// the links it is given.

type Props = {
  // Top bar: the signed-in store, or the courier's name.
  title: string;
  // Where the menu's "Closets Monterrey" goes: the area's home.
  homeHref: string;
  // The one link the top bar keeps.
  topLink: { href: string; label: string };
  groups: PanelNavGroup[];
  // "← Volver a …" on inner pages. The seller panel nests pages (a garment inside Mis prendas);
  // the courier's sections are all siblings in the menu, so it has none.
  showBackLink?: boolean;
  children: React.ReactNode;
};

export function PanelShell({ title, homeHref, topLink, groups, showBackLink = true, children }: Props) {
  const pathname = usePathname();
  const activeHref = activePanelHref(pathname, groups.flatMap((group) => group.items.map((item) => item.href).filter((href): href is string => href !== null)));
  const collapsed = useSidebarCollapsed();
  // On a phone the menu (and its counts) hides behind the button, so the button carries the total.
  const waiting = groups.reduce((sum, group) => sum + group.items.reduce((count, item) => count + (item.badge?.count ?? 0), 0), 0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Stable, so the drawer's open effect (focus, scroll lock, Escape) runs once per opening
  // instead of on every re-render of the shell.
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  return (
    <div className="min-h-screen bg-[#faf9f6] lg:flex">
      <aside
        aria-label="Menú del panel"
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-stone-200 bg-white transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex ${collapsed ? "w-[4.5rem]" : "w-60"}`}
      >
        {/* The toggle sits by the brand, not at the bottom: it stays put while the menu
            changes width, and the bottom-left corner is where Next's dev badge lives. */}
        <div className={`flex min-h-16 items-center gap-1 border-b border-stone-200 ${collapsed ? "justify-center px-2" : "pl-5 pr-2"}`}>
          {!collapsed && (
            <Link href={homeHref} className="min-w-0 flex-1 truncate font-serif text-lg tracking-tight text-stone-900">Closets Monterrey</Link>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!collapsed)}
            aria-controls="panel-nav-desktop"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
            title={collapsed ? "Expandir menú" : "Contraer menú"}
            className="grid size-10 shrink-0 place-items-center text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
          >
            <PanelIcon name={collapsed ? "expand" : "collapse"} />
          </button>
        </div>
        <PanelNav id="panel-nav-desktop" groups={groups} activeHref={activeHref} collapsed={collapsed} />
        <div className="border-t border-stone-200 p-2">
          {!collapsed && <div className="px-3"><NotificationsToggle compact /></div>}
          <SignOutButton collapsed={collapsed} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b border-stone-200 bg-white px-2 sm:px-6 lg:min-h-16 lg:px-8">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={waiting > 0 ? `Abrir menú del panel (${waiting} pendientes)` : "Abrir menú del panel"}
            aria-expanded={drawerOpen}
            aria-controls="panel-drawer"
            className="relative grid size-11 shrink-0 place-items-center text-stone-800 lg:hidden"
          >
            <PanelIcon name="menu" size={24} />
            {waiting > 0 && <span aria-hidden="true" className="absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#a3261b] px-1 text-[11px] font-semibold leading-none text-white">{waiting}</span>}
          </button>
          {/* Truncates so "Ver tienda" is never pushed off a narrow phone. */}
          <p className="min-w-0 flex-1 truncate font-condensed text-base font-bold uppercase text-stone-900 lg:text-lg">{title}</p>
          <Link href={topLink.href} className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap px-2 text-xs uppercase tracking-[0.12em] text-stone-700 underline-offset-4 hover:underline">
            {topLink.label}
          </Link>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
          {showBackLink && <PanelBackLink />}
          {children}
        </main>
      </div>

      <AnimatePresence>
        {drawerOpen && <PanelDrawer groups={groups} homeHref={homeHref} activeHref={activeHref} onClose={closeDrawer} />}
      </AnimatePresence>
    </div>
  );
}

function PanelDrawer({ groups, homeHref, activeHref, onClose }: { groups: PanelNavGroup[]; homeHref: string; activeHref: string | null; onClose: () => void }) {
  const reduceMotion = useReducedMotion();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const };

  useEffect(() => {
    closeButtonRef.current?.focus();
    // The page behind the drawer must not scroll under the finger.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-stone-900/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={transition}
        onClick={onClose}
      />
      <motion.div
        id="panel-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menú del panel"
        className="absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col bg-white shadow-xl"
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={transition}
      >
        <div className="flex min-h-14 items-center justify-between border-b border-stone-200 pl-5 pr-1">
          <Link href={homeHref} onClick={onClose} className="truncate font-serif text-lg tracking-tight text-stone-900">Closets Monterrey</Link>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Cerrar menú" className="grid size-11 place-items-center text-stone-800">
            <PanelIcon name="close" size={24} />
          </button>
        </div>
        <PanelNav id="panel-nav-mobile" groups={groups} activeHref={activeHref} collapsed={false} onNavigate={onClose} />
        <div className="border-t border-stone-200 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="px-3"><NotificationsToggle compact /></div>
          <SignOutButton collapsed={false} />
        </div>
      </motion.div>
    </div>
  );
}

function PanelNav({ id, groups, activeHref, collapsed, onNavigate }: {
  id: string;
  groups: PanelNavGroup[];
  activeHref: string | null;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav id={id} aria-label="Panel" className="flex-1 overflow-y-auto py-3">
      {groups.map((group, index) => (
        <div key={group.id} className="mb-3 last:mb-0">
          {collapsed ? (
            index > 0 && <hr className="mx-3 mb-2 border-stone-200" />
          ) : (
            <p id={`${id}-${group.id}`} className="px-5 pb-1 pt-2 text-[10px] uppercase tracking-[0.22em] text-stone-500">{group.label}</p>
          )}
          <ul aria-labelledby={collapsed ? undefined : `${id}-${group.id}`} aria-label={collapsed ? group.label : undefined} className="space-y-0.5 px-2">
            {group.items.map((item) => {
              const label = <span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span>;
              if (item.href === null) {
                return (
                  <li key={item.label}>
                    <span
                      aria-disabled="true"
                      title={collapsed ? `${item.label} · Próximamente` : undefined}
                      className={`flex min-h-11 cursor-not-allowed items-center gap-3 border-l-[3px] border-transparent px-3 text-sm text-stone-400 ${collapsed ? "justify-center" : ""}`}
                    >
                      <PanelIcon name={item.icon} />
                      {label}
                      <span className={collapsed ? "sr-only" : "ml-auto shrink-0 bg-stone-100 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-stone-500"}>Próximamente</span>
                    </span>
                  </li>
                );
              }
              const active = item.href === activeHref;
              const badge = item.badge && item.badge.count > 0 ? item.badge : null;
              const count = "grid h-5 min-w-5 place-items-center rounded-full bg-[#a3261b] px-1.5 text-[11px] font-semibold leading-none text-white";
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? (badge ? `${item.label} · ${badge.label}` : item.label) : undefined}
                    className={`flex min-h-11 items-center gap-3 border-l-[3px] px-3 text-sm transition-colors ${collapsed ? "justify-center" : ""} ${active ? "border-pine bg-[#e6eee9] font-semibold text-pine" : "border-transparent text-stone-700 hover:bg-stone-100 hover:text-stone-900"}`}
                  >
                    <span className="relative">
                      <PanelIcon name={item.icon} />
                      {badge && collapsed && <span aria-hidden="true" className={`absolute -right-2.5 -top-2 ${count}`}>{badge.count}</span>}
                    </span>
                    {/* The number alone means nothing to a screen reader; the label says what is waiting. */}
                    <span className={collapsed ? "sr-only" : "truncate"}>{item.label}{badge && <span className="sr-only"> ({badge.label})</span>}</span>
                    {badge && !collapsed && <span aria-hidden="true" className={`ml-auto shrink-0 ${count}`}>{badge.count}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SignOutButton({ collapsed }: { collapsed: boolean }) {
  return (
    <form action={signOutFromPanel}>
      <button
        type="submit"
        title={collapsed ? "Cerrar sesión" : undefined}
        className={`flex min-h-11 w-full items-center gap-3 px-3 text-sm text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 ${collapsed ? "justify-center" : ""}`}
      >
        <PanelIcon name="signOut" />
        <span className={collapsed ? "sr-only" : "whitespace-nowrap"}>Cerrar sesión</span>
      </button>
    </form>
  );
}

// The collapsed choice is per viewer and per device, so it lives in localStorage. Read through
// useSyncExternalStore: the server always renders the menu expanded, and the stored choice
// applies right after hydration without a hydration mismatch.
let collapsedState: boolean | null = null;
const listeners = new Set<() => void>();

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed it.
  function onStorage(event: StorageEvent) {
    if (event.key !== SIDEBAR_COLLAPSED_STORAGE_KEY) return;
    collapsedState = readSidebarCollapsed(browserStorage());
    listener();
  }
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  if (collapsedState === null) collapsedState = readSidebarCollapsed(browserStorage());
  return collapsedState;
}

function useSidebarCollapsed() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

function setSidebarCollapsed(collapsed: boolean) {
  collapsedState = collapsed;
  writeSidebarCollapsed(browserStorage(), collapsed);
  listeners.forEach((listener) => listener());
}
