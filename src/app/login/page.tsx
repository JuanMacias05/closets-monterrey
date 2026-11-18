import Link from "next/link";
import { PhoneLoginForm } from "@/components/auth/phone-login-form";
import { safeNextPath } from "@/features/auth/next-path";

export const metadata = { title: "Iniciar sesión | Closets Monterrey" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const nextPath = safeNextPath((await searchParams).next);
  const signUpHref = nextPath ? `/registro?next=${encodeURIComponent(nextPath)}` : "/registro";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf9f6] px-4 py-12">
      <section className="w-full max-w-md border border-stone-200 bg-white px-6 py-9 sm:px-10 sm:py-12">
        <Link href="/" className="font-serif text-lg tracking-tight text-stone-800">Closets Monterrey</Link>
        <p className="mt-10 text-[11px] uppercase tracking-[0.24em] text-stone-600">Iniciar sesión</p>
        <h1 className="mt-3 font-serif text-3xl tracking-tight text-stone-900">Bienvenida a tu closet.</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">Entra con el celular de tu cuenta; te mandamos un código por SMS.</p>
        <PhoneLoginForm nextPath={nextPath} />
        <div className="mt-7 space-y-2 border-t border-stone-100 pt-5 text-center text-sm leading-5 text-stone-600">
          <p>¿Aún no tienes cuenta? <Link href={signUpHref} className="font-medium text-pine underline underline-offset-4">Crear cuenta</Link></p>
          <p>¿Quieres vender? <Link href="/registro?tipo=vendedora" className="font-medium text-pine underline underline-offset-4">Crear cuenta de vendedora</Link></p>
        </div>
      </section>
    </main>
  );
}
