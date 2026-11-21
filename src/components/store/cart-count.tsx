"use client";

import { useState } from "react";

// The header's cart number. It bumps when it goes up (an item was just added and the header
// re-rendered with the new count), never on page load or when an item is removed.
export function CartCount({ count, className = "" }: { count: number; className?: string }) {
  const [previous, setPrevious] = useState(count);
  const [bumps, setBumps] = useState(0);

  // Adjusting state while rendering, React's pattern for reacting to a prop change.
  if (count !== previous) {
    setPrevious(count);
    if (count > previous) setBumps(bumps + 1);
  }

  return <span key={bumps} className={`${bumps > 0 ? "cart-bump" : ""} ${className}`}>{count}</span>;
}
