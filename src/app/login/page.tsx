import { BrandWordmark } from "@/components/brand/brand-wordmark";
import Link from "next/link";
import { PhoneLoginForm } from "@/components/auth/phone-login-form";
import { safeNextPath } from "@/features/auth/next-path";

export const metadata = { title: "Iniciar sesión | BZRS Monterrey" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const nextPath = safeNextPath((await searchParams).next);
  const signUpHref = nextPath ? `/registro?next=${encodeURIComponent(nextPath)}` : "/registro";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf9f6] px-4 py-12">
      <section className="w-full max-w-md border border-stone-200 bg-white px-6 py-9 sm:px-10 sm:py-12">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="text-lg text-stone-800"><BrandWordmark /></Link>
          <Link href="/" aria-label="Volver a la tienda" className="inline-flex min-h-11 items-center whitespace-nowrap text-xs uppercase tracking-[0.14em] text-stone-600 underline-offset-4 hover:underline">
            ← <span className="ml-1 sm:hidden">Tienda</span><span className="ml-1 hidden sm:inline">Volver a la tienda</span>
          </Link>
        </div>
        <h1 className="mt-10 font-serif text-3xl tracking-tight text-stone-900">Entra a BZRS.</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">Escribe tu celular y te mandamos un código por SMS.</p>
        <PhoneLoginForm nextPath={nextPath} />
        {/* One sign-up link: /registro is where a shopper, seller or courier picks her account type. */}
        <p className="mt-7 border-t border-stone-100 pt-5 text-center text-sm leading-5 text-stone-600">
          ¿No tienes cuenta? <Link href={signUpHref} className="font-medium text-pine underline underline-offset-4">Crear cuenta</Link>
        </p>
      </section>
    </main>
  );
}
