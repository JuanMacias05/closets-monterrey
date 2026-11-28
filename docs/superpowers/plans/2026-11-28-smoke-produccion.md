# Smoke de producción Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un smoke de Playwright de solo lectura contra producción que corre después de cada deploy y publica su reporte HTML en GitHub Pages.

**Architecture:** Carpeta `smoke/` con su propio config (`playwright.smoke.config.ts`), separada de `e2e/`. Un fixture automático bloquea toda escritura y los errores de JS. Un workflow escucha `deployment_status` de Vercel y publica `playwright-report-smoke/` en Pages.

**Tech Stack:** `@playwright/test` (ya instalado), GitHub Actions (`actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`).

**Spec:** `docs/superpowers/specs/2026-11-28-smoke-produccion-design.md`

## Global Constraints

- Base URL: `SMOKE_BASE_URL`, por omisión `https://closets-monterrey-nl.vercel.app`.
- Solo GET/HEAD/OPTIONS salen del navegador; cualquier otro método se aborta y la prueba falla.
- Ninguna prueba inicia sesión, envía el formulario de login ni envía la búsqueda del panel (`POST /api/buscar/terminos` guarda términos en producción): la búsqueda se prueba entrando a `/?q=…`.
- El commit y el push los hace Juan.

## Review Focus

1. Catálogo con menos de 2 prendas (hoy hay 1): orden y paginación pasan revisando controles, sin comparar.
2. Catálogo vacío en producción: el smoke debe fallar en Inicio (no es un sitio sano).
3. Sitio caído o 500: `page.goto` debe dar status < 400; si no, rojo.
4. Una escritura inesperada al cargar (p. ej. un server action en el render): el guard la aborta y marca la prueba.
5. Corrida sin pruebas: Playwright sale con error ("No tests found"), el job queda rojo.

---

### Task 1: Config, guard y script

**Files:**
- Create: `playwright.smoke.config.ts`, `smoke/fixtures.ts`
- Modify: `package.json` (script `test:smoke`), `.gitignore` (`/playwright-report-smoke/`, `/test-results-smoke/`)

**Interfaces:**
- Produces: `smoke/fixtures.ts` exporta `test` (extiende el de Playwright con un fixture automático `guard`) y `expect`.

- [ ] Config: `testDir: "./smoke"`, `retries: 1`, `workers: 2`, `forbidOnly: !!process.env.CI`, reporter `[["list"], ["html", { outputFolder: "playwright-report-smoke", open: "never" }]]`, `outputDir: "test-results-smoke"`, `use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" }`, proyecto chromium Desktop. Sin `webServer`.
- [ ] Guard: `page.route("**/*")` aborta métodos fuera de GET/HEAD/OPTIONS y los guarda; `page.on("pageerror")` guarda errores; al terminar, `expect(writes).toEqual([])` y `expect(pageErrors).toEqual([])`.
- [ ] `npm run typecheck` y `npm run lint` pasan.

### Task 2: Casos del smoke

**Files:**
- Create: `smoke/storefront.spec.ts` (inicio, detalle), `smoke/catalog.spec.ts` (ordenar, paginación, filtro, búsqueda), `smoke/public-pages.spec.ts` (login, privacidad, robots, sitemap)

**Interfaces:**
- Consumes: `test`, `expect` de `smoke/fixtures.ts`.

- [ ] `home loads with the BZRS title and at least one garment`: status < 400, título `/BZRS/`, `getByTestId("product-grid").locator("article")` ≥ 1.
- [ ] `opens a garment's detail page`: clic en el primer `Ver <nombre>`, URL `/prendas/`, h1 con el nombre, texto `MXN` visible.
- [ ] `sorts by price both ways`: en `/?ver=todo`, panel "Filtros" → `#filters-sort` = `price-asc` → URL `sort=price-asc`; si hay ≥2 precios, ascendentes. Igual con `price-desc`.
- [ ] `paginates the full catalog`: lee "a–b de T prendas"; si T > 24, "Cargar 24 prendas más" → URL `page=2` y prendas distintas; si no, ese link no existe y `/?ver=todo&page=2` regresa a `/?ver=todo` con prendas (arreglo del PGRST103).
- [ ] `filters by category`: panel → primera opción con valor de `#filters-category` → URL `category=` y se ve grid o mensaje de vacío.
- [ ] `search results page answers`: con la primera palabra del nombre de una prenda, `/?q=…` muestra "Resultados de búsqueda" y esa prenda; `/?q=zzqxv` muestra "No encontramos prendas con esa búsqueda."
- [ ] `login page shows the phone form without sending it`: heading "Entra a BZRS.", campo "Número de celular", botón "Enviar código" habilitado.
- [ ] `privacy, robots and sitemap respond`: `/privacidad` status < 400 con heading; `/robots.txt` 200 con `Sitemap:`; `/sitemap.xml` 200 con `<urlset`.
- [ ] `npm run test:smoke` en verde contra producción; romper un selector a propósito da rojo con captura en el reporte.

### Task 3: Workflow y Pages

**Files:**
- Create: `.github/workflows/smoke.yml`

- [ ] `on: deployment_status` + `workflow_dispatch`; job con `if` = dispatch, o `state == 'success'` y `startsWith(environment, 'Production')`.
- [ ] Pasos: checkout, node 22, `npm ci`, `npx playwright install --with-deps chromium`, `npm run test:smoke` con `continue-on-error`, `configure-pages`, `upload-pages-artifact` (path `playwright-report-smoke`, `if: always()`), `deploy-pages`, y al final `exit 1` si el smoke falló.
- [ ] Permisos `contents: read`, `pages: write`, `id-token: write`; `concurrency` para no pisar publicaciones.
- [ ] YAML válido (parse local).
