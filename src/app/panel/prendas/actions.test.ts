import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateProduct, deleteProductWithImages, setProductPrice } from "@/app/panel/prendas/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const adminId = "10000000-0000-4000-8000-000000000004";
const foreignProductId = "20000000-0000-4000-8000-000000000001";

function mockAdmin() {
  const filters: Array<[string, unknown]> = [];
  const update = vi.fn();
  const remove = vi.fn();
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: adminId } }, error: null }) },
    from: vi.fn((table: string) => ({
      select: vi.fn(() => {
        const query = {
          eq: vi.fn((column: string, value: unknown) => { filters.push([column, value]); return query; }),
          maybeSingle: vi.fn().mockResolvedValue(table === "profiles"
            ? { data: { role: "admin", status: "approved" }, error: null }
            : { data: null, error: null }),
        };
        return query;
      }),
      update,
      delete: vi.fn(),
    })),
    storage: { from: vi.fn(() => ({ remove })) },
  };
  return { supabase, filters, update, remove };
}

describe("product actions enforce ownership for admins too", () => {
  beforeEach(() => vi.clearAllMocks());

  it("checks the session before accessing product data", async () => {
    const from = vi.fn();
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from,
    } as never);

    const result = await updateProduct(foreignProductId, {
      name: "Prueba", description: "", category: "tops", size: "M", condition: "new", price_mxn: 10000,
    });

    expect(result).toEqual({ ok: false, error: "Inicia sesión para administrar tus prendas." });
    expect(from).not.toHaveBeenCalled();
  });

  it("will not edit another seller's product", async () => {
    const { supabase, filters, update } = mockAdmin();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(supabase as never);

    const result = await updateProduct(foreignProductId, {
      name: "Cambio ajeno", description: "", category: "tops", size: "M", condition: "new", price_mxn: 10000,
    });

    expect(result).toEqual({ ok: false, error: "No encontramos esa prenda en tu tienda." });
    expect(filters).toContainEqual(["seller_id", adminId]);
    expect(update).not.toHaveBeenCalled();
  });

  it("will not delete another seller's product or its files", async () => {
    const { supabase, filters, remove } = mockAdmin();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(supabase as never);

    const result = await deleteProductWithImages(foreignProductId);

    expect(result).toEqual({ ok: false, error: "No encontramos esa prenda en tu tienda." });
    expect(filters).toContainEqual(["seller_id", adminId]);
    expect(remove).not.toHaveBeenCalled();
  });

  it("will not change the price of another seller's product", async () => {
    const { supabase, filters, update } = mockAdmin();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(supabase as never);

    const result = await setProductPrice(foreignProductId, 25000);

    expect(result).toEqual({ ok: false, error: "No encontramos esa prenda en tu tienda." });
    expect(filters).toContainEqual(["seller_id", adminId]);
    expect(update).not.toHaveBeenCalled();
  });

  it.each([-1, 1.5, Number.NaN, 100_000_001])("rejects an invalid price (%s) before touching data", async (price) => {
    const { supabase, update } = mockAdmin();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(supabase as never);

    expect(await setProductPrice(foreignProductId, price)).toEqual({ ok: false, error: "Escribe un precio válido." });
    expect(update).not.toHaveBeenCalled();
  });
});
