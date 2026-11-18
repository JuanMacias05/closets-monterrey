import { execFileSync, spawnSync } from "node:child_process";

function parseStatusValue(output, name) {
  const line = output.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
  if (!line) return undefined;
  return line.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, "");
}

let status;
try {
  status = execFileSync("npx", ["supabase", "status", "-o", "env"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch {
  process.stderr.write("Supabase local no está disponible. Inicia Docker y corre `npx supabase start` antes de Playwright.\n");
  process.exit(1);
}

const supabaseUrl = parseStatusValue(status, "API_URL");
const publishableKey = parseStatusValue(status, "PUBLISHABLE_KEY") ?? parseStatusValue(status, "ANON_KEY");
if (!supabaseUrl || !publishableKey) {
  process.stderr.write("No pudimos obtener la URL y la publishable key de Supabase local (`npx supabase status -o env`).\n");
  process.exit(1);
}

const result = spawnSync("npx", ["playwright", "test", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: {
    ...process.env,
    CATALOG_DEMO_MODE: "true",
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    // Local-stack admin key so specs can reset accounts they create (e.g. the sign-up flow).
    // It only exists for `supabase start`; it is never the production key.
    E2E_SUPABASE_SECRET_KEY: parseStatusValue(status, "SECRET_KEY") ?? parseStatusValue(status, "SERVICE_ROLE_KEY") ?? "",
  },
});

process.exit(result.status ?? 1);
