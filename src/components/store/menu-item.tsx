"use client";

import Link from "next/link";
import { PanelIcon } from "@/components/panel/panel-icons";
import type { PanelNavItem } from "@/features/panel/panel-navigation";
import { startViewingAsBuyer } from "@/features/viewer/view-as-actions";

const row = "flex min-h-11 w-full items-center gap-3 px-3 text-left font-sans text-sm font-normal normal-case tracking-normal";

// One entry of the PANEL or MI CUENTA menu: a link, an action, or an announced item.
export function MenuItem({ item, active, onNavigate }: { item: PanelNavItem; active: boolean; onNavigate?: () => void }) {
  const badge = item.badge && item.badge.count > 0 ? item.badge : null;
  const content = (
    <>
      <PanelIcon name={item.icon} />
      {/* The number alone means nothing to a screen reader; the label says what is waiting. */}
      <span className="min-w-0 flex-1 truncate">{item.label}{badge && <span className="sr-only"> ({badge.label})</span>}</span>
      {badge && <span aria-hidden="true" className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-[#a3261b] px-1.5 text-[11px] font-semibold leading-none text-white">{badge.count}</span>}
    </>
  );
  if (item.action === "view-as-buyer") {
    return (
      <form action={startViewingAsBuyer}>
        <button type="submit" className={`${row} text-stone-700 hover:bg-stone-100 hover:text-stone-900`}>{content}</button>
      </form>
    );
  }
  if (item.href === null) {
    return (
      <span aria-disabled="true" className={`${row} cursor-not-allowed text-stone-400`}>
        <PanelIcon name={item.icon} />
        <span className="flex-1 truncate">{item.label}</span>
        <span className="shrink-0 bg-stone-100 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-stone-500">Próximamente</span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`${row} border-l-[3px] transition-colors motion-reduce:transition-none ${active ? "border-pine bg-[#e6eee9] font-semibold text-pine" : "border-transparent text-stone-700 hover:bg-stone-100 hover:text-stone-900"}`}
    >
      {content}
    </Link>
  );
}
