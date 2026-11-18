import Link from "next/link";
import { PhoneLoginForm } from "@/components/auth/phone-login-form";

export const metadata = { title: "Crear cuenta | Closets Monterrey" };

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf9f6] px-4 py-12">
      <section className="w-full max-w-md border border-stone-200 bg-white px-6 py-9 sm:px-10 sm:py-12">
        <Link href="/" className="font-serif text-lg tracking-tight text-stone-800">Closets Monterrey</Link>
        <p className="mt-10 text-[11px] uppercase tracking-[0.24em] text-stone-600">Nueva vendedora</p>
        <h1 className="mt-3 font-serif text-3xl tracking-tight text-stone-900">Abre tu closet.</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">Te mandamos un código por SMS. Tu cuenta queda en revisión hasta que la administración la apruebe; después ya puedes subir prendas.</p>
        <PhoneLoginForm mode="signup" />
        <p className="mt-7 border-t border-stone-100 pt-5 text-center text-sm leading-5 text-stone-600">¿Ya tienes cuenta? <Link href="/login" className="font-medium text-pine underline underline-offset-4">Iniciar sesión</Link></p>
      </section>
    </main>
  );
}
