import { PRODUCT_CATEGORIES, type CatalogAudience } from "@/features/products/types";

// The category values are shared, but their women's-wear labels ("Blusas y tops",
// "Pantalones y faldas") read wrong under Hombre, and Hombre has no dresses at all.
const MEN_LABELS: Partial<Record<(typeof PRODUCT_CATEGORIES)[number]["value"], string>> = {
  tops: "Playeras y camisas",
  bottoms: "Pantalones",
  outerwear: "Chamarras y sacos",
  shoes: "Calzado",
  accessories: "Accesorios",
};

export function categoriesForSection(audience?: CatalogAudience) {
  if (audience !== "men") return PRODUCT_CATEGORIES.map(({ value, label }) => ({ value, label }));
  return PRODUCT_CATEGORIES.flatMap(({ value }) => {
    const label = MEN_LABELS[value];
    return label ? [{ value, label }] : [];
  });
}
