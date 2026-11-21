import { getPopularSearchTerms, recordSearchTerm } from "@/features/search/search-data";

// "Lo más buscado" chips.
export async function GET() {
  const terms = await getPopularSearchTerms();
  return Response.json({ terms }, { headers: { "Cache-Control": "private, max-age=300" } });
}

// Counts a submitted search. Always 204: the caller fires and forgets, and telling a script
// which terms were accepted would only help it.
export async function POST(request: Request) {
  const body = await request.text();
  if (body.length <= 1000) {
    try {
      const { term } = JSON.parse(body) as { term?: unknown };
      if (typeof term === "string") await recordSearchTerm(term);
    } catch {
      // Not JSON: nothing to count.
    }
  }
  return new Response(null, { status: 204 });
}
