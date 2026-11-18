import Link from "next/link";
import { PhoneLoginForm } from "@/components/auth/phone-login-form";
import { safeNextPath } from "@/features/auth/next-path";

export const metadata = { title: "Crear cuenta | Closets Monterrey" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const isSeller = params.tipo === "vendedora";
  const nextPath = safeNextPath(params.next);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf9f6] px-4 py-12">
      <section className="w-full max-w-md border border-stone-200 bg-white px-6 py-9 sm:px-10 sm:py-12">
        <Link href="/" className="font-serif text-lg tracking-tight text-stone-800">Closets Monterrey</Link>
        {isSeller ? (
          <>
            <p className="mt-10 text-[11px] uppercase tracking-[0.24em] text-stone-600">Nueva vendedora</p>
            <h1 className="mt-3 font-serif text-3xl tracking-tight text-stone-900">Abre tu closet.</h1>
            <p className="mt-3 text-sm leading-6 text-stone-600">Te mandamos un código por SMS. Tu cuenta queda en revisión hasta que la administración la apruebe; después ya puedes subir prendas.</p>
            <PhoneLoginForm mode="seller-signup" />
          </>
        ) : (
          <>
            <p className="mt-10 text-[11px] uppercase tracking-[0.24em] text-stone-600">Crear cuenta</p>
            <h1 className="mt-3 font-serif text-3xl tracking-tight text-stone-900">Guarda y aparta tus prendas.</h1>
            <p className="mt-3 text-sm leading-6 text-stone-600">Con tu cuenta guardas favoritos, armas tu carrito y apartas con un anticipo directo a la vendedora.</p>
            <PhoneLoginForm mode="buyer-signup" nextPath={nextPath} />
          </>
        )}
        <div className="mt-7 space-y-2 border-t border-stone-100 pt-5 text-center text-sm leading-5 text-stone-600">
          <p>¿Ya tienes cuenta? <Link href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"} className="font-medium text-pine underline underline-offset-4">Iniciar sesión</Link></p>
          {isSeller
            ? <p>¿Solo quieres comprar? <Link href="/registro" className="font-medium text-pine underline underline-offset-4">Crear cuenta de compradora</Link></p>
            : <p>¿Quieres vender? <Link href="/registro?tipo=vendedora" className="font-medium text-pine underline underline-offset-4">Crear cuenta de vendedora</Link></p>}
        </div>
      </section>
    </main>
  );
}
