import Link from "next/link";
import { PhoneLoginForm } from "@/components/auth/phone-login-form";

export const metadata = { title: "Iniciar sesión | Closets Monterrey" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf9f6] px-4 py-12">
      <section className="w-full max-w-md border border-stone-200 bg-white px-6 py-9 sm:px-10 sm:py-12">
        <Link href="/" className="font-serif text-lg tracking-tight text-stone-800">Closets Monterrey</Link>
        <p className="mt-10 text-[10px] uppercase tracking-[0.24em] text-stone-500">Acceso de vendedoras</p>
        <h1 className="mt-3 font-serif text-3xl tracking-tight text-stone-900">Bienvenida a tu closet.</h1>
        <p className="mt-3 text-sm leading-6 text-stone-500">Inicia sesión con el celular asociado a tu cuenta.</p>
        <PhoneLoginForm />
        <p className="mt-7 border-t border-stone-100 pt-5 text-center text-xs leading-5 text-stone-400">El acceso está disponible para cuentas habilitadas por la administración.</p>
      </section>
    </main>
  );
}
