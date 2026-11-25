import { redirect } from "next/navigation";
import { SellerRatingBadge } from "@/components/sellers/seller-rating-badge";
import { getSellerRating } from "@/features/sellers/seller-rating";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Calificaciones | BZRS Monterrey" };

type Rating = { reservation_id: string; stars: number; comment: string | null; rated_at: string; buyer_municipality: string | null };

const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "America/Monterrey" });

// The stars and comments buyers left the store (my_seller_ratings, 20261128000100). Who rated
// is not shown, only where she lives; a comment an admin hid shows as hidden.
export default async function SellerRatingsPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data }, stats] = await Promise.all([supabase.rpc("my_seller_ratings"), getSellerRating(user.id)]);
  const ratings = (data ?? []) as Rating[];

  return (
    <section>
      <h1 className="font-serif text-3xl tracking-tight text-stone-900">Calificaciones</h1>
      <p className="mt-2"><SellerRatingBadge rating={stats} /></p>
      <p className="mt-2 max-w-2xl text-sm text-stone-600">Después de cada entrega, quien compró puede calificar tu bazar de 1 a 5 estrellas. El promedio sale en tu bazar y en cada prenda; los comentarios solo los ves tú.</p>
      {ratings.length === 0 ? (
        <p className="mt-6 text-sm text-stone-600">Todavía no tienes calificaciones.</p>
      ) : (
        <ul className="mt-6 divide-y divide-stone-200 border-y border-stone-200">
          {ratings.map((rating) => (
            <li key={rating.reservation_id} className="py-3 text-sm text-stone-700">
              <p className="flex flex-wrap items-baseline justify-between gap-2">
                <span aria-label={`${rating.stars} de 5 estrellas`} className="text-stone-900">{"★".repeat(rating.stars)}<span className="text-stone-300">{"★".repeat(5 - rating.stars)}</span></span>
                <span className="text-xs text-stone-500">{dateFormat.format(new Date(rating.rated_at))}{rating.buyer_municipality ? ` · ${rating.buyer_municipality}` : ""}</span>
              </p>
              {rating.comment && <p className="mt-1">“{rating.comment}”</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
