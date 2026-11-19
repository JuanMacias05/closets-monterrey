import {
  PRODUCT_CATEGORIES,
  PRODUCT_CONDITIONS,
  PRODUCT_SIZES,
  type CatalogFilters,
  type CatalogSort,
} from "@/features/products/types";

export type SearchParamValue = string | string[] | undefined;
export type CatalogSearchParams = Record<string, SearchParamValue>;

const allowedCategories = new Set<string>(PRODUCT_CATEGORIES.map(({ value }) => value));
const allowedSizes = new Set<string>(PRODUCT_SIZES);
const allowedConditions = new Set<string>(PRODUCT_CONDITIONS.map(({ value }) => value));
const allowedSorts = new Set<string>(["recent", "price-asc", "price-desc"]);

function firstValue(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInteger(value: SearchParamValue): number | undefined {
  const rawValue = firstValue(value);
  if (rawValue === undefined || rawValue.trim() === "") return undefined;

  const parsed = Number(rawValue);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

export function parseCatalogFilters(params: CatalogSearchParams): CatalogFilters {
  const audience = firstValue(params.audience);
  const delivery = firstValue(params.entrega);
  const category = firstValue(params.category);
  const size = firstValue(params.size);
  const condition = firstValue(params.condition);
  const sort = firstValue(params.sort);
  const requestedPage = parsePositiveInteger(params.page) ?? 1;

  return {
    audience: audience === "women" || audience === "men" ? audience : undefined,
    delivery: delivery && (delivery === "domicilio" || /^[0-9a-f-]{36}$/i.test(delivery)) ? delivery : undefined,
    category: category && allowedCategories.has(category)
      ? (category as CatalogFilters["category"])
      : undefined,
    size: size && allowedSizes.has(size) ? (size as CatalogFilters["size"]) : undefined,
    condition: condition && allowedConditions.has(condition)
      ? (condition as CatalogFilters["condition"])
      : undefined,
    minPrice: parsePositiveInteger(params.minPrice),
    maxPrice: parsePositiveInteger(params.maxPrice),
    hideSold: firstValue(params.hideSold) === "1",
    sort: sort && allowedSorts.has(sort) ? (sort as CatalogSort) : "recent",
    page: Math.max(1, requestedPage),
    showAll: firstValue(params.ver) === "todo",
  };
}

export function buildCatalogQueryString(
  filters: CatalogFilters,
  page = 1,
): string {
  const params = new URLSearchParams();

  if (filters.audience) params.set("audience", filters.audience);
  if (filters.delivery) params.set("entrega", filters.delivery);
  if (filters.category) params.set("category", filters.category);
  if (filters.size) params.set("size", filters.size);
  if (filters.condition) params.set("condition", filters.condition);
  if (filters.minPrice !== undefined) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== undefined) params.set("maxPrice", String(filters.maxPrice));
  if (filters.hideSold) params.set("hideSold", "1");
  if (filters.sort !== "recent") params.set("sort", filters.sort);
  if (filters.showAll) params.set("ver", "todo");
  if (page > 1) params.set("page", String(page));

  return params.toString();
}
