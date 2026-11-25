// The words a shared garment or store carries (link preview title/description and the text sent
// with the link). Pure, for tests.

const CONDITIONS: Record<string, string> = { new: "Nuevo", like_new: "Como nuevo", used: "Usado" };

// "$650" / "$1,250": whole pesos read better in a preview than "$650.00 MXN".
export function shortPrice(cents: number): string {
  const pesos = cents / 100;
  const digits = Number.isInteger(pesos) ? 0 : 2;
  return `$${new Intl.NumberFormat("es-MX", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(pesos)}`;
}

export function garmentShareTitle(product: { name: string; price_mxn: number; size: string }): string {
  return `${product.name} · ${shortPrice(product.price_mxn)} · Talla ${product.size}`;
}

export function garmentShareDescription(product: { condition: string; seller: { store_name: string } }): string {
  return `De ${product.seller.store_name} · ${conditionLabel(product.condition)} · BZRS Monterrey`;
}

export function storeShareDescription(storeName: string, available: number): string {
  const count = available === 1 ? "1 prenda disponible" : `${available} prendas disponibles`;
  return `${storeName} en BZRS Monterrey · ${count}`;
}

export function conditionLabel(condition: string): string {
  return CONDITIONS[condition] ?? condition;
}
