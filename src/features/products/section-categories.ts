import { PRODUCT_CATEGORIES, type ProductAudience } from "@/features/products/types";

// Category labels depend on who the garment is for. The stored values never change (tops,
// bottoms, dresses...); only the words do. Mujer keeps the original labels, Hombre gets men's
// wording and no dresses, and Unisex (or no section: the whole catalog) gets neutral wording
// with every category.

export type CategoryValue = (typeof PRODUCT_CATEGORIES)[number]["value"];

const WOMEN: Record<CategoryValue, string> = Object.fromEntries(PRODUCT_CATEGORIES.map(({ value, label }) => [value, label])) as Record<CategoryValue, string>;

const MEN: Partial<Record<CategoryValue, string>> = {
  tops: "Camisas y playeras",
  bottoms: "Pantalones y shorts",
  outerwear: "Chamarras y sacos",
  shoes: "Calzado",
  accessories: "Accesorios",
};

const NEUTRAL: Record<CategoryValue, string> = {
  tops: "Playeras, camisas y tops",
  bottoms: "Pantalones, shorts y faldas",
  dresses: "Vestidos",
  outerwear: "Chamarras y sacos",
  shoes: "Calzado",
  accessories: "Accesorios",
};

function labelsFor(audience?: ProductAudience | null): Partial<Record<CategoryValue, string>> {
  if (audience === "women") return WOMEN;
  if (audience === "men") return MEN;
  return NEUTRAL;
}

// The categories offered for an audience, in the usual order, with its labels.
export function categoriesFor(audience?: ProductAudience | null): { value: CategoryValue; label: string }[] {
  const labels = labelsFor(audience);
  return PRODUCT_CATEGORIES.flatMap(({ value }) => (labels[value] ? [{ value, label: labels[value]! }] : []));
}

// The Mujer/Hombre menus and pages; no section = the whole catalog (neutral labels).
export function categoriesForSection(audience?: "women" | "men") {
  return categoriesFor(audience ?? null);
}

// IMPORTANT: also enforced by the garment server actions (panel/prendas/actions.ts). Hombre has no
// dresses; every other audience can use any category.
export function isCategoryAllowed(category: string, audience: ProductAudience): boolean {
  return categoriesFor(audience).some((item) => item.value === category);
}

// One garment's category as its audience reads it. A combination the rule forbids (a men's
// dress saved before the rule) still shows a word rather than the raw value.
export function categoryLabel(category: string, audience?: ProductAudience | null): string {
  const labels = labelsFor(audience);
  return labels[category as CategoryValue] ?? NEUTRAL[category as CategoryValue] ?? category;
}
