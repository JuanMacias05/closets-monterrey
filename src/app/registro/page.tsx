import Link from "next/link";
import { SignUpFlow } from "@/components/auth/sign-up-flow";
import { safeNextPath } from "@/features/auth/next-path";

export const metadata = { title: "Crear cuenta | Closets Monterrey" };

// One sign-up for everyone: the account buys; selling and delivering are checkboxes after the
// SMS code (they start pending). ?next= still brings her back where she was.
export default async function SignUpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
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
        <SignUpFlow nextPath={nextPath} />
        <p className="mt-5 text-center text-xs leading-5 text-stone-500">
          Al crear tu cuenta aceptas el <Link href="/privacidad" className="underline underline-offset-4">Aviso de privacidad</Link>.
        </p>
        <p className="mt-5 border-t border-stone-100 pt-5 text-center text-sm leading-5 text-stone-600">
          ¿Ya tienes cuenta? <Link href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"} className="font-medium text-pine underline underline-offset-4">Iniciar sesión</Link>
        </p>
      </section>
    </main>
  );
}
