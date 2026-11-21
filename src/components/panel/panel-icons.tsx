import type { PanelNavIcon } from "@/features/panel/panel-navigation";

// Hand-drawn 24×24 stroke icons for the panel menu. Inline SVG instead of an icon package: the
// menu needs about a dozen, and the rest of the site already draws its few icons inline.
const PATHS: Record<PanelNavIcon | "menu" | "close" | "collapse" | "expand" | "signOut", React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  garments: (
    <>
      <path d="M10 5a2 2 0 1 1 2 2v1.5" />
      <path d="M12 8.5 3.4 15a1 1 0 0 0 .6 1.8h16a1 1 0 0 0 .6-1.8z" />
    </>
  ),
  add: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  reservations: (
    <>
      <path d="M5 8h14l-1 12.5H6z" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </>
  ),
  store: (
    <>
      <path d="M4 10.5V20h16v-9.5" />
      <path d="M3 4h18l-1.2 4.8a2.5 2.5 0 0 1-4.8 0 3 3 0 0 1-6 0 2.5 2.5 0 0 1-4.8 0z" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  live: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4" />
      <path d="M4.9 19.1a10 10 0 0 1 0-14.2M19.1 4.9a10 10 0 0 1 0 14.2" />
    </>
  ),
  sellers: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M21.5 20a6.5 6.5 0 0 0-4-6" />
    </>
  ),
  buyers: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  couriers: (
    <>
      <path d="M2.5 6h11v10h-11z" />
      <path d="M13.5 9.5h4l3.5 3.5v3h-7.5" />
      <circle cx="6.5" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  allGarments: (
    <>
      <path d="M12 3 3 8l9 5 9-5z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  support: <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.4A8.5 8.5 0 1 1 21 11.5z" />,
  rates: (
    <>
      <path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  requests: (
    <>
      <path d="M3.5 13.5 6 5h12l2.5 8.5V19a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" />
      <path d="M3.5 13.5H9a3 3 0 0 0 6 0h5.5" />
    </>
  ),
  route: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  profile: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1" />
      <circle cx="9" cy="11" r="2.5" />
      <path d="M5.5 17a3.5 3.5 0 0 1 7 0M15 10h3M15 13.5h3" />
    </>
  ),
  messages: (
    <>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </>
  ),
  ratings: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  collapse: <path d="m15 6-6 6 6 6" />,
  expand: <path d="m9 6 6 6-6 6" />,
  signOut: (
    <>
      <path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" />
      <path d="M10 8l-4 4 4 4M6 12h10" />
    </>
  ),
};

export type PanelIconName = keyof typeof PATHS;

export function PanelIcon({ name, size = 20 }: { name: PanelIconName; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {PATHS[name]}
    </svg>
  );
}
