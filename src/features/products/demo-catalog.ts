import { applyCatalogFilters } from "@/features/products/filter-products";
import type { CatalogFilters, CatalogProduct } from "@/features/products/types";

const localImages = (kind: string, alt: string): CatalogProduct["images"] => [
  {
    id: `${kind}-front`,
    source: "local_placeholder",
    storage_path: `/placeholders/${kind}-front.svg`,
    alt_text: `${alt}, vista frontal`,
    position: 0,
    url: `/placeholders/${kind}-front.svg`,
  },
  {
    id: `${kind}-detail`,
    source: "local_placeholder",
    storage_path: `/placeholders/${kind}-detail.svg`,
    alt_text: `Detalle de ${alt.toLowerCase()}`,
    position: 1,
    url: `/placeholders/${kind}-detail.svg`,
  },
];

const renata = { store_name: "Closet de Renata", slug: "closet-de-renata" };
const sofia = { store_name: "El clóset de Sofía", slug: "el-closet-de-sofia" };

export const demoProducts: CatalogProduct[] = [
  { id: "20000000-0000-4000-8000-000000000001", slug: "top-satin-marfil", name: "Top satinado marfil", description: "Corte fluido y tirantes ajustables.", category: "tops", size: "S", condition: "like_new", price_mxn: 35000, sale_status: "available", created_at: "2026-11-13T10:00:00.000Z", seller: renata, images: localImages("top", "Top satinado marfil") },
  { id: "20000000-0000-4000-8000-000000000002", slug: "blusa-lino-arena", name: "Blusa de lino arena", description: "Lino ligero con botones nacarados.", category: "tops", size: "M", condition: "new", price_mxn: 48000, sale_status: "available", created_at: "2026-11-12T10:00:00.000Z", seller: renata, images: localImages("top", "Blusa de lino arena") },
  { id: "20000000-0000-4000-8000-000000000003", slug: "jeans-rectos-azul", name: "Jeans rectos azul medio", description: "Denim de tiro alto, corte recto.", category: "bottoms", size: "28", condition: "used", price_mxn: 42000, sale_status: "available", created_at: "2026-11-11T10:00:00.000Z", seller: renata, images: localImages("bottom", "Jeans rectos azul medio") },
  { id: "20000000-0000-4000-8000-000000000004", slug: "falda-midi-oliva", name: "Falda midi oliva", description: "Silueta en A con cintura elástica.", category: "bottoms", size: "M", condition: "like_new", price_mxn: 29000, sale_status: "reserved", created_at: "2026-11-10T10:00:00.000Z", seller: renata, images: localImages("bottom", "Falda midi oliva") },
  { id: "20000000-0000-4000-8000-000000000005", slug: "vestido-floral", name: "Vestido floral de verano", description: "Estampado discreto y falda con movimiento.", category: "dresses", size: "S", condition: "used", price_mxn: 65000, sale_status: "available", created_at: "2026-11-09T10:00:00.000Z", seller: renata, images: localImages("dress", "Vestido floral de verano") },
  { id: "20000000-0000-4000-8000-000000000006", slug: "vestido-satin-champana", name: "Vestido satinado champaña", description: "Vestido midi con espalda cruzada.", category: "dresses", size: "M", condition: "new", price_mxn: 72000, sale_status: "sold", created_at: "2026-11-08T10:00:00.000Z", seller: renata, images: localImages("dress", "Vestido satinado champaña") },
  { id: "20000000-0000-4000-8000-000000000007", slug: "blazer-oversize-piedra", name: "Blazer oversize piedra", description: "Saco ligero con hombro relajado.", category: "outerwear", size: "L", condition: "like_new", price_mxn: 85000, sale_status: "available", created_at: "2026-11-14T08:00:00.000Z", seller: sofia, images: localImages("outerwear", "Blazer oversize piedra") },
  { id: "20000000-0000-4000-8000-000000000008", slug: "chamarra-denim-clasica", name: "Chamarra denim clásica", description: "Básico de mezclilla con bolsillos frontales.", category: "outerwear", size: "M", condition: "used", price_mxn: 62000, sale_status: "sold", created_at: "2026-11-06T10:00:00.000Z", seller: sofia, images: localImages("outerwear", "Chamarra denim clásica") },
  { id: "20000000-0000-4000-8000-000000000009", slug: "tenis-blancos-minimal", name: "Tenis blancos minimal", description: "Tenis casuales en buen estado.", category: "shoes", size: "24", condition: "used", price_mxn: 50000, sale_status: "available", created_at: "2026-11-12T08:00:00.000Z", seller: sofia, images: localImages("shoes", "Tenis blancos minimal") },
  { id: "20000000-0000-4000-8000-000000000010", slug: "botines-piel-negra", name: "Botines de piel negra", description: "Tacón bajo y cierre lateral.", category: "shoes", size: "25", condition: "like_new", price_mxn: 95000, sale_status: "reserved", created_at: "2026-11-05T08:00:00.000Z", seller: sofia, images: localImages("shoes", "Botines de piel negra") },
  { id: "20000000-0000-4000-8000-000000000011", slug: "bolso-bandolera-caramelo", name: "Bolso bandolera caramelo", description: "Bolso compacto con correa ajustable.", category: "accessories", size: "Única", condition: "like_new", price_mxn: 56000, sale_status: "available", created_at: "2026-11-14T07:00:00.000Z", seller: sofia, images: localImages("accessory", "Bolso bandolera caramelo") },
  { id: "20000000-0000-4000-8000-000000000012", slug: "bolsa-mini-marfil", name: "Bolsa mini marfil", description: "Bolsa estructurada para ocasiones especiales.", category: "accessories", size: "Única", condition: "new", price_mxn: 39000, sale_status: "sold", created_at: "2026-11-04T08:00:00.000Z", seller: sofia, images: localImages("accessory", "Bolsa mini marfil") },
];

export function getDemoCatalogPage(filters: CatalogFilters, pageSize: number) {
  return applyCatalogFilters(demoProducts, filters, pageSize);
}
