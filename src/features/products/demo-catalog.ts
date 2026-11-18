import { applyCatalogFilters } from "@/features/products/filter-products";
import type { CatalogFilters, CatalogProduct } from "@/features/products/types";

const localImages = (kind: string, alt: string): CatalogProduct["images"] => [
  {
    id: `${kind}-front`,
    source: "local_placeholder",
    storage_path: `/placeholders/${kind}-front.svg`,
    alt_text: `${alt}, vista frontal`,
    position: 0,
    width: 900,
    height: 1100,
    url: `/placeholders/${kind}-front.svg`,
  },
  {
    id: `${kind}-detail`,
    source: "local_placeholder",
    storage_path: `/placeholders/${kind}-detail.svg`,
    alt_text: `Detalle de ${alt.toLowerCase()}`,
    position: 1,
    width: 900,
    height: 1100,
    url: `/placeholders/${kind}-detail.svg`,
  },
];

const renata = { store_name: "Closet de Renata", slug: "closet-de-renata", avatar_path: null };
const sofia = { store_name: "El clóset de Sofía", slug: "el-closet-de-sofia", avatar_path: null };

export const demoProducts: CatalogProduct[] = [
  { id: "20000000-0000-4000-8000-000000000001", slug: "top-satin-marfil", name: "Top satinado marfil", description: "Corte fluido y tirantes ajustables.", audience: "women", category: "tops", size: "S", condition: "like_new", price_mxn: 35000, sale_status: "available", measurements: { busto_cm: 88, largo_cm: 52 }, created_at: "2026-11-13T10:00:00.000Z", seller: renata, images: localImages("top", "Top satinado marfil") },
  { id: "20000000-0000-4000-8000-000000000002", slug: "blusa-lino-arena", name: "Blusa de lino arena", description: "Lino ligero con botones nacarados.", audience: "women", category: "tops", size: "M", condition: "new", price_mxn: 48000, sale_status: "available", created_at: "2026-11-12T10:00:00.000Z", seller: renata, images: localImages("top", "Blusa de lino arena") },
  { id: "20000000-0000-4000-8000-000000000003", slug: "jeans-rectos-azul", name: "Jeans rectos azul medio", description: "Denim de tiro alto, corte recto.", audience: "women", category: "bottoms", size: "28", condition: "used", price_mxn: 42000, sale_status: "available", created_at: "2026-11-11T10:00:00.000Z", seller: renata, images: localImages("bottom", "Jeans rectos azul medio") },
  { id: "20000000-0000-4000-8000-000000000004", slug: "falda-midi-oliva", name: "Falda midi oliva", description: "Silueta en A con cintura elástica.", audience: "women", category: "bottoms", size: "M", condition: "like_new", price_mxn: 29000, sale_status: "reserved", created_at: "2026-11-10T10:00:00.000Z", seller: renata, images: localImages("bottom", "Falda midi oliva") },
  { id: "20000000-0000-4000-8000-000000000005", slug: "vestido-floral", name: "Vestido floral de verano", description: "Estampado discreto y falda con movimiento.", audience: "women", category: "dresses", size: "S", condition: "used", price_mxn: 65000, sale_status: "available", created_at: "2026-11-09T10:00:00.000Z", seller: renata, images: localImages("dress", "Vestido floral de verano") },
  { id: "20000000-0000-4000-8000-000000000006", slug: "vestido-satin-champana", name: "Vestido satinado champaña", description: "Vestido midi con espalda cruzada.", audience: "women", category: "dresses", size: "M", condition: "new", price_mxn: 72000, sale_status: "sold", created_at: "2026-11-08T10:00:00.000Z", seller: renata, images: localImages("dress", "Vestido satinado champaña") },
  { id: "20000000-0000-4000-8000-000000000007", slug: "blazer-oversize-piedra", name: "Blazer oversize piedra", description: "Saco ligero con hombro relajado.", audience: "women", category: "outerwear", size: "L", condition: "like_new", price_mxn: 85000, sale_status: "available", created_at: "2026-11-14T08:00:00.000Z", seller: sofia, images: localImages("outerwear", "Blazer oversize piedra") },
  { id: "20000000-0000-4000-8000-000000000008", slug: "chamarra-denim-clasica", name: "Chamarra denim clásica", description: "Básico de mezclilla con bolsillos frontales.", audience: "women", category: "outerwear", size: "M", condition: "used", price_mxn: 62000, sale_status: "sold", created_at: "2026-11-06T10:00:00.000Z", seller: sofia, images: localImages("outerwear", "Chamarra denim clásica") },
  { id: "20000000-0000-4000-8000-000000000009", slug: "tenis-blancos-minimal", name: "Tenis blancos minimal", description: "Tenis casuales en buen estado.", audience: "women", category: "shoes", size: "24", condition: "used", price_mxn: 50000, sale_status: "available", created_at: "2026-11-12T08:00:00.000Z", seller: sofia, images: localImages("shoes", "Tenis blancos minimal") },
  { id: "20000000-0000-4000-8000-000000000010", slug: "botines-piel-negra", name: "Botines de piel negra", description: "Tacón bajo y cierre lateral.", audience: "women", category: "shoes", size: "25", condition: "like_new", price_mxn: 95000, sale_status: "reserved", created_at: "2026-11-05T08:00:00.000Z", seller: sofia, images: localImages("shoes", "Botines de piel negra") },
  { id: "20000000-0000-4000-8000-000000000011", slug: "bolso-bandolera-caramelo", name: "Bolso bandolera caramelo", description: "Bolso compacto con correa ajustable.", audience: "women", category: "accessories", size: "Única", condition: "like_new", price_mxn: 56000, sale_status: "available", created_at: "2026-11-14T07:00:00.000Z", seller: sofia, images: localImages("accessory", "Bolso bandolera caramelo") },
  { id: "20000000-0000-4000-8000-000000000012", slug: "bolsa-mini-marfil", name: "Bolsa mini marfil", description: "Bolsa estructurada para ocasiones especiales.", audience: "women", category: "accessories", size: "Única", condition: "new", price_mxn: 39000, sale_status: "sold", created_at: "2026-11-04T08:00:00.000Z", seller: sofia, images: localImages("accessory", "Bolsa mini marfil") },
  { id: "20000000-0000-4000-8000-000000000013", slug: "camisa-oxford-azul-hombre", name: "Camisa Oxford azul", description: "Camisa de algodón Oxford, manga larga y cuello con botones.", audience: "men", category: "tops", size: "M", condition: "like_new", price_mxn: 38000, sale_status: "available", created_at: "2026-11-14T09:00:00.000Z", seller: sofia, images: localImages("top", "Camisa Oxford azul") },
  { id: "20000000-0000-4000-8000-000000000014", slug: "pantalon-chino-caqui-hombre", name: "Pantalón chino caqui", description: "Corte recto, gabardina ligera.", audience: "men", category: "bottoms", size: "L", condition: "used", price_mxn: 45000, sale_status: "available", created_at: "2026-11-13T09:00:00.000Z", seller: sofia, images: localImages("bottom", "Pantalón chino caqui") },
  { id: "20000000-0000-4000-8000-000000000015", slug: "playera-basica-negra-hombre", name: "Playera básica negra", description: "Algodón pesado, cuello redondo.", audience: "men", category: "tops", size: "L", condition: "new", price_mxn: 22000, sale_status: "available", created_at: "2026-11-14T06:00:00.000Z", seller: sofia, images: localImages("top", "Playera básica negra") },
  { id: "20000000-0000-4000-8000-000000000016", slug: "jeans-slim-oscuro-hombre", name: "Jeans slim azul oscuro", description: "Corte slim, mezclilla con poco elástico.", audience: "men", category: "bottoms", size: "28", condition: "like_new", price_mxn: 52000, sale_status: "available", created_at: "2026-11-12T06:00:00.000Z", seller: sofia, images: localImages("bottom", "Jeans slim azul oscuro") },
  { id: "20000000-0000-4000-8000-000000000017", slug: "chamarra-bomber-olivo-hombre", name: "Chamarra bomber olivo", description: "Bomber ligera con puños de punto.", audience: "men", category: "outerwear", size: "XL", condition: "used", price_mxn: 68000, sale_status: "available", created_at: "2026-11-11T06:00:00.000Z", seller: sofia, images: localImages("outerwear", "Chamarra bomber olivo") },
  { id: "20000000-0000-4000-8000-000000000018", slug: "tenis-piel-blancos-hombre", name: "Tenis de piel blancos", description: "Piel lisa, suela de goma.", audience: "men", category: "shoes", size: "28", condition: "like_new", price_mxn: 79000, sale_status: "available", created_at: "2026-11-10T06:00:00.000Z", seller: sofia, images: localImages("shoes", "Tenis de piel blancos") },
  { id: "20000000-0000-4000-8000-000000000019", slug: "gorra-lona-beige-hombre", name: "Gorra de lona beige", description: "Ajuste trasero con hebilla.", audience: "men", category: "accessories", size: "Única", condition: "new", price_mxn: 18000, sale_status: "available", created_at: "2026-11-09T06:00:00.000Z", seller: sofia, images: localImages("accessory", "Gorra de lona beige") },
];

export function getDemoCatalogPage(filters: CatalogFilters, pageSize: number) {
  return applyCatalogFilters(demoProducts, filters, pageSize);
}
