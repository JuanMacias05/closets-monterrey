export const PRODUCT_CATEGORIES = [
  { value: "tops", label: "Blusas y tops" },
  { value: "bottoms", label: "Pantalones y faldas" },
  { value: "dresses", label: "Vestidos" },
  { value: "outerwear", label: "Chamarras y sacos" },
  { value: "shoes", label: "Calzado" },
  { value: "accessories", label: "Accesorios" },
] as const;

export const PRODUCT_SIZES = ["XS", "S", "M", "L", "XL", "24", "25", "26", "27", "28", "Única"] as const;

export const PRODUCT_CONDITIONS = [
  { value: "new", label: "Nuevo" },
  { value: "like_new", label: "Como nuevo" },
  { value: "used", label: "Usado" },
] as const;

export type ProductCondition = (typeof PRODUCT_CONDITIONS)[number]["value"];
export type ProductSaleStatus = "available" | "reserved" | "sold";
export type CatalogSort = "recent" | "price-asc" | "price-desc";

export type CatalogFilters = {
  category?: (typeof PRODUCT_CATEGORIES)[number]["value"];
  size?: (typeof PRODUCT_SIZES)[number];
  condition?: ProductCondition;
  minPrice?: number;
  maxPrice?: number;
  hideSold: boolean;
  sort: CatalogSort;
  page: number;
};

export type CatalogImage = {
  id: string;
  source: "local_placeholder" | "storage";
  storage_path: string;
  alt_text: string;
  position: number;
  url: string;
};

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  size: string;
  condition: ProductCondition;
  price_mxn: number;
  sale_status: ProductSaleStatus;
  created_at: string;
  seller: { store_name: string; slug: string };
  images: CatalogImage[];
};

export type CatalogPageResult = {
  products: CatalogProduct[];
  total: number;
  error: string | null;
};
