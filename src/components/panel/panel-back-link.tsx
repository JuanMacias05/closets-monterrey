"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Every panel page below /panel gets a way back up one level: a garment being edited goes back
// to "Mis prendas", everything else to the panel home. The panel layout is a server component
// shared by all of them, so the current path is read here on the client.
export function PanelBackLink() {
  const pathname = usePathname();
  if (pathname === "/panel") return null;
  const toProducts = /^\/panel\/prendas\/.+/.test(pathname);
  const href = toProducts ? "/panel/prendas" : "/panel";
  const label = toProducts ? "Mis prendas" : "Panel";
  return (
    <Link href={href} className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm text-stone-700 underline-offset-4 hover:underline">
      <span aria-hidden="true">←</span> Volver a {label}
    </Link>
  );
}
