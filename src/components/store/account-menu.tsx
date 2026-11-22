"use client";

import { usePathname } from "next/navigation";
import { signOutFromPanel } from "@/app/panel/actions";
import { PanelIcon } from "@/components/panel/panel-icons";
import { MenuItem } from "@/components/store/menu-item";
import { useHoverMenu } from "@/components/store/use-hover-menu";
import { activePanelHref, type PanelNavItem } from "@/features/panel/panel-navigation";

// "MI CUENTA ▾" in the white store nav, for every signed-in account: her purchases, one inbox for
// all her chats, favorites, notifications, and "Hacer algo más" to ask to sell or deliver.
export function AccountMenu({ items, extra, unread }: { items: PanelNavItem[]; extra: PanelNavItem[]; unread: number }) {
  const pathname = usePathname();
  const { open, close, rootProps, buttonProps } = useHoverMenu();
  const all = [...items, ...extra];
  const active = activePanelHref(pathname, all.flatMap((item) => (item.href ? [item.href] : [])));

  return (
    <div {...rootProps} className="relative">
      <button type="button" aria-haspopup="true" aria-controls="account-menu" {...buttonProps} className="press flex min-h-11 items-center gap-1 font-condensed font-bold uppercase hover:text-stone-600">
        Mi cuenta
        {unread > 0 && <span className="ml-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#a3261b] px-1 font-sans text-[11px] font-semibold text-white"><span aria-hidden="true">{unread}</span><span className="sr-only"> ({unread === 1 ? "1 mensaje sin leer" : `${unread} mensajes sin leer`})</span></span>}
        <PanelIcon name="chevron" size={16} />
      </button>
      {open && (
        <div id="account-menu" role="group" aria-label="Mi cuenta" className="absolute right-0 top-full z-50 mt-1 w-64 border border-stone-200 bg-white p-2 font-sans font-normal normal-case tracking-normal text-stone-900 shadow-xl">
          <ul>{items.map((item) => <li key={item.label}><MenuItem item={item} active={item.href === active} onNavigate={close} /></li>)}</ul>
          {extra.length > 0 && (
            <>
              <hr className="my-2 border-stone-200" />
              <p id="account-menu-more" className="px-3 pb-1 text-[10px] uppercase tracking-[0.22em] text-stone-500">Hacer algo más</p>
              <ul aria-labelledby="account-menu-more">{extra.map((item) => <li key={item.label}><MenuItem item={item} active={item.href === active} onNavigate={close} /></li>)}</ul>
            </>
          )}
          <hr className="my-2 border-stone-200" />
          <form action={signOutFromPanel}>
            <button type="submit" className="flex min-h-11 w-full items-center gap-3 px-3 font-sans text-sm normal-case tracking-normal text-stone-700 hover:bg-stone-100 hover:text-stone-900">
              <PanelIcon name="signOut" />
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
