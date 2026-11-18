"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizePhoneE164 } from "@/features/auth/phone-number";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function PhoneLoginForm() {
  const router = useRouter();
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const normalizedPhone = normalizePhoneE164(phoneInput);
    if (!normalizedPhone) {
      setError("Escribe el celular con código de país, por ejemplo +52 81 2345 6789.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("No está configurada la conexión con Supabase.");
      return;
    }

    setIsBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        phone: normalizedPhone,
        options: { shouldCreateUser: false },
      });
      if (authError) {
        setError("No pudimos enviar el código. Verifica que la cuenta esté habilitada e inténtalo de nuevo.");
        return;
      }
      setPhone(normalizedPhone);
      setStep("otp");
    } catch {
      setError("No pudimos conectar con el servicio de autenticación. Inténtalo de nuevo.");
    } finally {
      setIsBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(otp)) {
      setError("El código debe tener 6 dígitos.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("No está configurada la conexión con Supabase.");
      return;
    }

    setIsBusy(true);
    try {
      const { error: authError } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
      if (authError) {
        setError("El código no es válido o expiró. Revísalo e inténtalo de nuevo.");
        return;
      }
      router.replace("/panel");
      router.refresh();
    } catch {
      setError("No pudimos verificar el código. Inténtalo de nuevo.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="mt-8">
      {step === "phone" ? (
        <form onSubmit={requestCode} className="space-y-5">
          <label htmlFor="phone" className="block text-xs uppercase tracking-[0.16em] text-stone-600">Número de celular</label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="+52 81 2345 6789"
            value={phoneInput}
            onChange={(event) => setPhoneInput(event.target.value)}
            required
            className="min-h-12 w-full border-b border-stone-400 bg-transparent px-1 text-base outline-none focus:border-stone-900"
          />
          <button type="submit" disabled={isBusy} className="min-h-12 w-full bg-stone-900 px-5 text-xs uppercase tracking-[0.18em] text-white transition-colors hover:bg-stone-700 disabled:cursor-wait disabled:opacity-60">
            {isBusy ? "Enviando código…" : "Enviar código"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-5">
          <p className="text-sm leading-6 text-stone-600">Escribe el código enviado a <span className="font-medium text-stone-900">{phone}</span>.</p>
          <label htmlFor="otp" className="block text-xs uppercase tracking-[0.16em] text-stone-600">Código de verificación</label>
          <input
            id="otp"
            type="text"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="••••••"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            className="min-h-12 w-full border-b border-stone-400 bg-transparent px-1 text-center text-2xl tracking-[0.45em] outline-none focus:border-stone-900"
          />
          <button type="submit" disabled={isBusy} className="min-h-12 w-full bg-stone-900 px-5 text-xs uppercase tracking-[0.18em] text-white transition-colors hover:bg-stone-700 disabled:cursor-wait disabled:opacity-60">
            {isBusy ? "Verificando…" : "Verificar código"}
          </button>
          <button type="button" onClick={() => { setStep("phone"); setOtp(""); setError(null); }} className="min-h-11 w-full text-xs uppercase tracking-[0.14em] text-stone-600 underline underline-offset-4">
            Cambiar número
          </button>
        </form>
      )}

      {error && <p role="alert" className="mt-4 text-sm leading-5 text-red-700">{error}</p>}
    </div>
  );
}
