import { afterEach, describe, expect, it, vi } from "vitest";

const queryResult = vi.hoisted(() => ({ current: { data: null, count: null, error: null } as unknown }));

// Every builder call (from, select, eq, order, range, rpc...) returns the same chain, and
// awaiting it yields whatever the test put in queryResult.
vi.mock("@/lib/supabase/server", () => {
  const chain: unknown = new Proxy(() => {}, {
    get: (_target, property) =>
      property === "then"
        ? (resolve: (value: unknown) => void) => resolve(queryResult.current)
        : () => chain,
  });
  // The client itself must not be thenable, or awaiting createSupabaseServerClient() would
  // already resolve to the query result.
  const client = new Proxy({}, { get: (_target, property) => (property === "then" ? undefined : () => chain) });
  return { createSupabaseServerClient: async () => client };
});

import { getCatalogPage } from "@/features/products/catalog-data";

const filters = { hideSold: false, sort: "recent", page: 5, showAll: true } as const;

describe("getCatalogPage", () => {
  afterEach(() => {
    queryResult.current = { data: null, count: null, error: null };
  });

  it("reads a page past the end as an empty page, not as the catalog being down", async () => {
    queryResult.current = {
      data: null,
      count: null,
      error: { code: "PGRST103", message: "Requested range not satisfiable", details: "An offset of 96 was requested, but there are only 1 rows.", hint: null },
    };

    await expect(getCatalogPage(filters)).resolves.toEqual({ products: [], total: 0, error: null });
  });

  it("still reports any other query error as the catalog being unavailable", async () => {
    queryResult.current = { data: null, count: null, error: { code: "42P01", message: "relation does not exist", details: "", hint: null } };

    const result = await getCatalogPage(filters);

    expect(result.products).toEqual([]);
    expect(result.error).not.toBeNull();
  });
});
