import type { CatalogFilters, CatalogProduct } from "@/features/products/types";

export function applyCatalogFilters(
  products: CatalogProduct[],
  filters: CatalogFilters,
  pageSize = 24,
) {
  const filtered = products.filter((product) => {
    if (filters.audience && product.audience !== filters.audience && product.audience !== "unisex") return false;
    if (filters.category && product.category !== filters.category) return false;
    if (filters.size && product.size !== filters.size) return false;
    if (filters.condition && product.condition !== filters.condition) return false;
    if (filters.minPrice !== undefined && product.price_mxn < filters.minPrice * 100) return false;
    if (filters.maxPrice !== undefined && product.price_mxn > filters.maxPrice * 100) return false;
    if (filters.hideSold && product.sale_status === "sold") return false;
    return true;
  });

  filtered.sort((left, right) => {
    const soldOrder = Number(left.sale_status === "sold") - Number(right.sale_status === "sold");
    if (soldOrder !== 0) return soldOrder;

    if (filters.sort === "price-asc") return left.price_mxn - right.price_mxn;
    if (filters.sort === "price-desc") return right.price_mxn - left.price_mxn;
    return Date.parse(right.created_at) - Date.parse(left.created_at);
  });

  const total = filtered.length;
  const start = (filters.page - 1) * pageSize;

  return { products: filtered.slice(start, start + pageSize), total };
}
