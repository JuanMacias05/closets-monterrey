# Smoke de producción con Playwright y reporte en GitHub Pages

Fecha: 2026-11-28

## Por qué

Las pruebas e2e que ya existen (`e2e/`, 19 specs) corren contra un Supabase local con catálogo
de demo. Nada revisa el sitio real después de publicar. Se busca un smoke básico, como el que se
usa en el trabajo de QA de Juan: después de cada deploy a producción, confirmar que lo principal
funciona y verlo en una página con cada prueba en verde o rojo.

## Metas

- Un conjunto chico de pruebas de solo lectura contra `https://closets-monterrey-nl.vercel.app`.
- Corre solo después de cada deploy de producción en Vercel, y también a mano.
- El reporte HTML de Playwright publicado en GitHub Pages: qué pasó, qué falló, con captura y
  traza en las que fallan.

## No metas

- No reemplaza las e2e locales ni las mete al smoke.
- Sin pruebas que inicien sesión, creen cuentas, aparten, compren o manden SMS.
- Sin Allure ni historial entre corridas (opción B descartada por ahora).

## Anti-metas

- Que el smoke escriba algo en producción. Cualquier POST/PUT/PATCH/DELETE que salga del
  navegador se bloquea y hace fallar la prueba.
- Que pase en verde cuando el sitio está caído: cero pruebas ejecutadas o un 404/500 en una
  página principal es rojo.

## Enfoques considerados

- **A. Reporte de Playwright en GitHub Pages (elegido por Juan).** Sin dependencias nuevas;
  muestra verde/rojo, captura y traza.
- B. Allure en Pages con historial, como en Gencise. Más trabajo (guardar el historial entre
  corridas). Se puede agregar después.

## Diseño

- `playwright.smoke.config.ts` aparte: `testDir: "./smoke"`, sin `webServer`, `baseURL` desde
  `SMOKE_BASE_URL` (por omisión el dominio de producción), 1 reintento, reporter `html` + `list`,
  captura y traza solo al fallar.
- Un fixture que aborta toda petición que no sea GET/HEAD/OPTIONS y falla la prueba si ocurre, y
  que marca falla con cualquier error de JavaScript no atrapado (`pageerror`).
- Casos (`smoke/*.spec.ts`):
  1. Inicio: responde 200, título con BZRS, se ve al menos una prenda.
  2. Detalle: abrir la primera prenda muestra nombre y precio.
  3. Ordenar: elegir precio ↑ y ↓ cambia la URL (`sort=price-asc` / `price-desc`) sin error; si
     hay 2 o más prendas, los precios quedan en ese orden.
  4. Paginación: `?ver=todo&page=2` carga sin error; si hay 24 prendas o menos regresa a la página 1
     (antes mostraba "catálogo no disponible": PostgREST responde PGRST103 a un rango pasado
     el final); con más, la página 2 trae prendas distintas.
  5. Filtro: una categoría cambia la URL y la página carga sin error.
  6. Búsqueda: buscar un texto responde con resultados o el mensaje de vacío.
  7. Login: `/login` muestra el campo de teléfono y el botón; no se envía.
  8. SEO/legal: `/privacidad`, `/robots.txt` y `/sitemap.xml` responden 200.
- Script `npm run test:smoke`.
- Workflow `.github/workflows/smoke.yml`:
  - `on: deployment_status` (Vercel lo manda al terminar) filtrado a `state == success` y
    entorno `Production`, más `workflow_dispatch`.
  - Usa el dominio fijo de producción, no el `environment_url` del deploy, porque las URLs
    únicas de Vercel pueden estar protegidas y darían 401.
  - Publica `playwright-report/` en Pages con `actions/upload-pages-artifact` +
    `actions/deploy-pages`, aunque las pruebas fallen (`if: always()`); el job queda en rojo si
    alguna falló.

## Requisitos fuera del código

- El repo debe estar público (o con plan de pago) para Pages: primero terminar de recrear
  `closets-monterrey` y reconectar Vercel.
- En GitHub: Settings → Pages → Source = GitHub Actions.

## Lo que se deja a quien lo construya

- Selectores exactos (preferir roles y textos visibles).
- Qué categoría y qué texto de búsqueda usar, según lo que exista en producción.
