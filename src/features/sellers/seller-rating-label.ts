// How a store's rating reads in public (store page, "Vendido por"). Pure, for tests.
export type SellerRating = { ratings: number; rating: number } | null;

// "★ 4.8 · 12 calificaciones"; a store nobody rated yet is "Nuevo" rather than an empty 0.
export function sellerRatingLabel(stats: SellerRating): { text: string; accessible: string } {
  if (!stats || stats.ratings === 0) return { text: "Nuevo", accessible: "Tienda nueva, sin calificaciones todavía" };
  const average = stats.rating.toFixed(1);
  const count = stats.ratings === 1 ? "1 calificación" : `${stats.ratings} calificaciones`;
  return { text: `★ ${average} · ${count}`, accessible: `${average} de 5 estrellas, ${count}` };
}
