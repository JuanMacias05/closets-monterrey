import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveZoneRates } from "@/app/panel/admin/tarifas-envio/actions";
import { MUNICIPALITIES } from "@/features/couriers/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const allFees = (pesos: string) => Object.fromEntries(MUNICIPALITIES.map((name) => [name, pesos]));

function createMockSupabase(role = "admin") {
  const upserts: unknown[] = [];
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "10000000-0000-4000-8000-000000000004" } }, error: null }) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { role, status: "approved" }, error: null }) })) })),
      upsert: vi.fn((rows: unknown) => {
        upserts.push(rows);
        return Promise.resolve({ error: null });
      }),
    })),
  };
  return { supabase, upserts };
}

describe("saveZoneRates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses an unknown origin or a bad price before touching the database", async () => {
    expect((await saveZoneRates("Saltillo", allFees("90"))).ok).toBe(false);
    const result = await saveZoneRates("Monterrey", { ...allFees("90"), Apodaca: "90.50" });
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("Apodaca") });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("does not let a seller write rates", async () => {
    const { supabase, upserts } = createMockSupabase("seller");
    vi.mocked(createSupabaseServerClient).mockResolvedValue(supabase as never);

    expect((await saveZoneRates("Monterrey", allFees("90"))).ok).toBe(false);
    expect(upserts).toEqual([]);
  });

  it("saves every destination from the origin, in cents", async () => {
    const { supabase, upserts } = createMockSupabase();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(supabase as never);

    const result = await saveZoneRates("Monterrey", { ...allFees("100"), Monterrey: "60" });

    expect(result).toEqual({ ok: true });
    const rows = upserts[0] as { destination_municipality: string; fee_mxn: number }[];
    expect(rows).toHaveLength(MUNICIPALITIES.length);
    expect(rows.find((row) => row.destination_municipality === "Monterrey")?.fee_mxn).toBe(6000);
    expect(rows.find((row) => row.destination_municipality === "Juárez")?.fee_mxn).toBe(10000);
  });
});
