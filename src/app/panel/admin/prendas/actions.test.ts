import { beforeEach, describe, expect, it, vi } from "vitest";
import { setAdminProductVisibility } from "@/app/panel/admin/prendas/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const adminId = "10000000-0000-4000-8000-000000000004";
const productId = "20000000-0000-4000-8000-000000000001";

function mockClient(role = "admin") {
  const writes: unknown[] = [];
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: adminId } }, error: null }) },
    from: vi.fn((table: string) => ({
      select: vi.fn(() => {
        let selectedColumns = "";
        const query = {
          eq: vi.fn((column: string, value: string) => {
            if (column === "id" && table === "products") expect(value).toBe(productId);
            return query;
          }),
          maybeSingle: vi.fn().mockImplementation(async () => table === "profiles"
            ? { data: { role, status: "approved" }, error: null }
            : { data: { id: productId, slug: "top-satinado-marfil" }, error: null }),
          select: vi.fn((columns: string) => { selectedColumns = columns; void selectedColumns; return query; }),
        };
        return query;
      }),
      update: vi.fn((values: unknown) => {
        writes.push(values);
        return { eq: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: productId }, error: null }) })) })) };
      }),
    })),
  };
  return { supabase, writes };
}

describe("setAdminProductVisibility", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a seller before reading or writing products", async () => {
    const { supabase, writes } = mockClient("seller");
    vi.mocked(createSupabaseServerClient).mockResolvedValue(supabase as never);

    const result = await setAdminProductVisibility(productId, true);

    expect(result).toEqual({ ok: false, error: "Solo la administración puede cambiar la visibilidad del catálogo." });
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(writes).toEqual([]);
  });

  it("writes only hidden_by_admin after authenticating the admin", async () => {
    const { supabase, writes } = mockClient();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(supabase as never);

    const result = await setAdminProductVisibility(productId, true);

    expect(result).toEqual({ ok: true });
    expect(writes).toEqual([{ hidden_by_admin: true }]);
  });
});
