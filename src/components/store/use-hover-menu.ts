"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// A menu that opens on mouse hover, on keyboard focus and on click (the click pins it, which is
// also how it opens on a touch screen, where hover doesn't exist). Escape, a click outside and
// navigating close it.
export function useHoverMenu() {
  const [open, setOpen] = useState(false);
  // Opened by a click (stays until another click, Escape or a click outside) rather than by the
  // pointer passing over it (closes when the pointer leaves).
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState(pathname);

  // Navigating closes it: compared during render instead of in an effect (no extra render pass).
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    if (open) setOpen(false);
    if (pinned) setPinned(false);
  }

  const close = useCallback(() => { setOpen(false); setPinned(false); }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, close]);

  const rootProps = {
    ref: rootRef,
    onPointerEnter: (event: React.PointerEvent) => { if (event.pointerType === "mouse") setOpen(true); },
    onPointerLeave: (event: React.PointerEvent) => { if (event.pointerType === "mouse" && !pinned) setOpen(false); },
    onBlur: (event: React.FocusEvent) => {
      if (!pinned && !rootRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
    },
  };
  const buttonProps = {
    "aria-expanded": open,
    // A click on a menu the pointer already opened pins it instead of closing it again.
    onClick: () => {
      if (open && pinned) close();
      else { setOpen(true); setPinned(true); }
    },
    onFocus: () => setOpen(true),
  };
  return { open, close, rootProps, buttonProps };
}
