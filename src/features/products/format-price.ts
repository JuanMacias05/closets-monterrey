const mxnFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPriceMXN(priceInCents: number): string {
  return `${mxnFormatter.format(priceInCents / 100)} MXN`;
}
