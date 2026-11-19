import Link from "next/link";
import { PhoneLoginForm } from "@/components/auth/phone-login-form";
import { safeNextPath } from "@/features/auth/next-path";

export const metadata = { title: "Crear cuenta | Closets Monterrey" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const isSeller = params.tipo === "vendedora";
  const isCourier = params.tipo === "recolectora";
  const nextPath = safeNextPath(params.next);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf9f6] px-4 py-12">
      <section className="w-full max-w-md border border-stone-200 bg-white px-6 py-9 sm:px-10 sm:py-12">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="whitespace-nowrap font-serif text-lg tracking-tight text-stone-800">Closets Monterrey</Link>
          <Link href="/" aria-label="Volver a la tienda" className="inline-flex min-h-11 items-center whitespace-nowrap text-xs uppercase tracking-[0.14em] text-stone-600 underline-offset-4 hover:underline">
            ← <span className="ml-1 sm:hidden">Tienda</span><span className="ml-1 hidden sm:inline">Volver a la tienda</span>
          </Link>
        </div>
        {/* The login page has a single "Crear cuenta" link; the account type is chosen here. */}
        <nav aria-label="Tipo de cuenta" className="mt-8 grid grid-cols-3 border border-stone-300 text-center text-xs uppercase tracking-[0.12em]">
          <AccountTypeLink href={nextPath ? `/registro?next=${encodeURIComponent(nextPath)}` : "/registro"} active={!isSeller && !isCourier}>Comprar</AccountTypeLink>
          <AccountTypeLink href="/registro?tipo=vendedora" active={isSeller}>Vender</AccountTypeLink>
          <AccountTypeLink href="/registro?tipo=recolectora" active={isCourier}>Entregar</AccountTypeLink>
        </nav>
        {isCourier ? (
          <>
            <p className="mt-8 text-[11px] uppercase tracking-[0.24em] text-stone-600">Nueva recolectora</p>
            <h1 className="mt-3 font-serif text-3xl tracking-tight text-stone-900">Entrega prendas en tu ruta.</h1>
            <p className="mt-3 text-sm leading-6 text-stone-600">Te mandamos un código por SMS. Para verificarte, la administración revisa tu identificación en persona; después apareces como recolectora verificada.</p>
            <PhoneLoginForm mode="courier-signup" />
          </>
        ) : isSeller ? (
          <>
            <p className="mt-8 text-[11px] uppercase tracking-[0.24em] text-stone-600">Nueva vendedora</p>
            <h1 className="mt-3 font-serif text-3xl tracking-tight text-stone-900">Abre tu clóset.</h1>
            <p className="mt-3 text-sm leading-6 text-stone-600">Te mandamos un código por SMS. Tu cuenta queda en revisión hasta que la administración la apruebe; después ya puedes subir prendas.</p>
            <PhoneLoginForm mode="seller-signup" />
          </>
        ) : (
          <>
            <p className="mt-8 text-[11px] uppercase tracking-[0.24em] text-stone-600">Nueva compradora</p>
            <h1 className="mt-3 font-serif text-3xl tracking-tight text-stone-900">Guarda y aparta tus prendas.</h1>
            <p className="mt-3 text-sm leading-6 text-stone-600">Con tu cuenta guardas favoritos, armas tu carrito y apartas con un anticipo directo a la vendedora.</p>
            <PhoneLoginForm mode="buyer-signup" nextPath={nextPath} />
          </>
        )}
        <p className="mt-7 border-t border-stone-100 pt-5 text-center text-sm leading-5 text-stone-600">
          ¿Ya tienes cuenta? <Link href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"} className="font-medium text-pine underline underline-offset-4">Iniciar sesión</Link>
        </p>
      </section>
    </main>
  );
}

function AccountTypeLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center justify-center border-stone-300 [&:not(:first-child)]:border-l ${active ? "bg-pine text-white" : "text-stone-700 hover:bg-stone-50"}`}>
      {children}
    </Link>
  );
}
