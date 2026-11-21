import type { NextRequest } from "next/server";
import { getLiveSearchResults } from "@/features/search/search-data";

// Live results for the header search panel. GET, so the panel can cancel a stale request
// while the shopper keeps typing.
export async function GET(request: NextRequest) {
  const response = await getLiveSearchResults(request.nextUrl.searchParams.get("q") ?? "");
  // Sale status changes by the minute; a cached "Disponible" would be wrong.
  return Response.json(response, { headers: { "Cache-Control": "no-store" } });
}
