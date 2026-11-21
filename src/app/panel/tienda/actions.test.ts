import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveDeliverySettings, saveStoreSettings } from "@/app/panel/tienda/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const sellerId = "10000000-0000-4000-8000-000000000004";

function createMockSupabase({ user = true, role = "admin", status = "approved" } = {}) {
  const updates: Array<{ table: string; values: unknown }> = [];
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: user ? { id: sellerId } : null }, error: null }) },
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role, status, avatar_path: null },
            error: null,
          }),
        })),
      })),
      update: vi.fn((values: unknown) => {
        updates.push({ table, values });
        return { eq: vi.fn().mockResolvedValue({ error: null }) };
      }),
    })),
    storage: { from: vi.fn(() => ({ remove: vi.fn().mockResolvedValue({ error: null }) })) },
  };
  return { supabase, updates };
}

describe("saveStoreSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires a signed-in user before reading or writing a store", async () => {
    const { supabase } = createMockSupabase({ user: false });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(supabase as never);

    const result = await saveStoreSettings({ storeName: "Mi tienda", avatarPath: null, whatsapp: "", clabe: "" });

    expect(result.ok).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("rejects a pending profile before writes", async () => {
    const { supabase, updates } = createMockSupabase({ role: "seller", status: "pending" });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(supabase as never);

    const result = await saveStoreSettings({ storeName: "Mi tienda", avatarPath: null, whatsapp: "", clabe: "" });

    expect(result.ok).toBe(false);
    expect(updates).toEqual([]);
  });

  it("rejects an invalid CLABE before writing profile or settings", async () => {
    const { supabase, updates } = createMockSupabase();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(supabase as never);

    const result = await saveStoreSettings({
      storeName: "Mi tienda",
      avatarPath: null,
      whatsapp: "",
      clabe: "000000000000000001",
    });

    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("dígito verificador") });
    expect(updates).toEqual([]);
  });

  it("updates only the authenticated admin's own profile and private settings", async () => {
    const { supabase, updates } = createMockSupabase();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(supabase as never);

    const result = await saveStoreSettings({
      storeName: "Mi tienda",
      avatarPath: null,
      whatsapp: "81 1234 5678",
      clabe: "000000000000000000",
    });

    expect(result).toEqual({ ok: true });
    expect(updates).toEqual([
      { table: "profiles", values: { store_name: "Mi tienda", avatar_path: null } },
      { table: "seller_private_settings", values: { whatsapp_e164: "+528112345678", clabe: "000000000000000000" } },
    ]);
  });
});

describe("saveDeliverySettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses home delivery without the municipality she ships from, before touching the database", async () => {
    const result = await saveDeliverySettings({ pointIds: [], homeDelivery: true, origin: "", homeNote: "" });

    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("desde qué municipio envías") });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("refuses an origin outside the known municipalities", async () => {
    const result = await saveDeliverySettings({ pointIds: [], homeDelivery: true, origin: "Saltillo", homeNote: "" });

    expect(result.ok).toBe(false);
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("saves the origin instead of a fee", async () => {
    const { supabase, updates } = createMockSupabase();
    const deletes = { eq: vi.fn().mockResolvedValue({ error: null }) };
    const from = supabase.from;
    supabase.from = vi.fn((table: string) => (table === "seller_delivery_points" ? { delete: vi.fn(() => deletes) } : from(table))) as never;
    vi.mocked(createSupabaseServerClient).mockResolvedValue(supabase as never);

    const result = await saveDeliverySettings({ pointIds: [], homeDelivery: true, origin: "Apodaca", homeNote: " Solo Apodaca " });

    expect(result).toEqual({ ok: true });
    expect(updates).toEqual([
      { table: "profiles", values: { home_delivery_enabled: true, home_delivery_origin: "Apodaca", home_delivery_note: "Solo Apodaca" } },
    ]);
  });
});
