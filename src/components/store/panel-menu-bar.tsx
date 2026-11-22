"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelIcon } from "@/components/panel/panel-icons";
import { MenuItem } from "@/components/store/menu-item";
import { useHoverMenu } from "@/components/store/use-hover-menu";
import { activePanelHref, panelBadgeTotal, panelMenuLabel, type PanelNavGroup } from "@/features/panel/panel-navigation";

// The green top bar for accounts that do more than buy ("option B" of the accounts and menu
// proposal): who she is, "+ SUBIR PRENDA" and "PANEL ▾". The store keeps its look everywhere;
// the panel is this menu, one column per activity. On a phone, PANEL opens the same groups as a
// bottom sheet.
export function PanelMenuBar({ tag, name, groups, canUpload }: { tag: string; name: string; groups: PanelNavGroup[]; canUpload: boolean }) {
  const pathname = usePathname();
  const { open, close, rootProps, buttonProps } = useHoverMenu();
  const label = panelMenuLabel(pathname, groups);
  const total = panelBadgeTotal(groups);
  const active = activePanelHref(pathname, groups.flatMap((group) => group.items).flatMap((item) => (item.href ? [item.href] : [])));

  const columns = groups.map((group) => (
    <div key={group.id} className="min-w-0">
      <p id={`${group.id}-label`} className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-[0.22em] text-stone-500">{group.label}</p>
      {group.note ? (
        <p className="px-3 py-2 font-sans text-sm normal-case tracking-normal text-stone-700">{group.note}</p>
      ) : (
        <ul aria-labelledby={`${group.id}-label`}>
          {group.items.map((item) => (
            <li key={item.label}><MenuItem item={item} active={item.href !== null && item.href === active} onNavigate={close} /></li>
          ))}
        </ul>
      )}
    </div>
  ));

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-pine px-3 py-1.5 font-condensed text-sm font-bold uppercase tracking-[0.03em] text-white sm:px-6">
      <p className="flex min-w-0 items-center gap-2">
        <span className="bg-white px-2 py-0.5 text-xs text-pine">{tag}</span>
        <span className="truncate font-sans text-sm font-medium normal-case tracking-normal">{name}</span>
      </p>
      <nav aria-label="Herramientas del panel" className="flex items-center gap-1">
        {canUpload && (
          <Link href="/panel/prendas/nueva" className="flex min-h-9 items-center gap-1.5 bg-white px-3 text-pine hover:bg-stone-100">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Subir prenda
          </Link>
        )}
        <div {...rootProps} className="relative">
          <button type="button" aria-haspopup="true" aria-controls="panel-menu" {...buttonProps} className="flex min-h-9 items-center gap-1.5 px-3 uppercase hover:bg-white/10">
            <span className="max-w-[46vw] truncate sm:max-w-none">{label}</span>
            {total > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#a3261b] px-1 font-sans text-[11px] font-semibold text-white"><span aria-hidden="true">{total}</span><span className="sr-only"> ({total} pendientes)</span></span>}
            <PanelIcon name="chevron" size={16} />
          </button>
          {open && (
            <>
              {/* Laptop: a dropdown under the button, one column per activity. */}
              <div id="panel-menu" role="group" aria-label="Panel" className="absolute right-0 top-full z-50 mt-1 hidden gap-4 border border-stone-200 bg-white p-2 font-sans font-normal normal-case tracking-normal text-stone-900 shadow-xl lg:grid" style={{ gridTemplateColumns: `repeat(${Math.max(1, groups.length)}, 15rem)` }}>
                {columns}
              </div>
              {/* Phone: the same groups as a bottom sheet, scrolling inside, never sideways. */}
              <div className="fixed inset-0 z-50 lg:hidden">
                <button type="button" aria-label="Cerrar panel" onClick={close} className="absolute inset-0 bg-stone-900/40" />
                <div role="dialog" aria-modal="true" aria-label="Panel" className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto overflow-x-hidden bg-white px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 font-sans font-normal normal-case tracking-normal text-stone-900 shadow-2xl">
                  <div className="flex items-center justify-between pl-3">
                    <span aria-hidden="true" className="h-1 w-10 rounded-full bg-stone-300" />
                    <button type="button" onClick={close} className="min-h-11 px-3 text-sm text-stone-700 underline underline-offset-4">Cerrar</button>
                  </div>
                  <div className="grid gap-3">{columns}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </nav>
    </div>
  );
}
