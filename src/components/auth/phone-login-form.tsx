"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizePhoneE164 } from "@/features/auth/phone-number";
import { isValidFacebookUrl, normalizeFacebookUrl } from "@/features/shop/facebook-url";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// "login" refuses unknown numbers so a typo doesn't silently create a second account.
// "buyer-signup" creates a shopper (name + Facebook link, no approval needed).
// "seller-signup" creates a pending seller who can't sell until an admin approves her from
// /panel/admin/vendedoras.
export function PhoneLoginForm({ mode = "login", nextPath }: { mode?: "login" | "buyer-signup" | "seller-signup"; nextPath?: string }) {
  const router = useRouter();
  const [phoneInput, setPhoneInput] = useState("");
  const [storeName, setStoreName] = useState("");
  const [fullName, setFullName] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
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
    const trimmedStoreName = storeName.trim();
    if (mode === "seller-signup" && (trimmedStoreName.length === 0 || trimmedStoreName.length > 60)) {
      setError("Escribe el nombre de tu closet (máximo 60 caracteres).");
      return;
    }
    const trimmedFullName = fullName.trim();
    const normalizedFacebook = normalizeFacebookUrl(facebookUrl);
    if (mode === "buyer-signup") {
      if (trimmedFullName.length < 2 || trimmedFullName.length > 80) {
        setError("Escribe tu nombre (2 a 80 caracteres).");
        return;
      }
      if (!normalizedFacebook || !isValidFacebookUrl(normalizedFacebook)) {
        setError("Pega el link de tu perfil de Facebook, por ejemplo https://facebook.com/tu.nombre");
        return;
      }
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
        options: mode === "seller-signup"
          ? { shouldCreateUser: true, data: { store_name: trimmedStoreName } }
          : mode === "buyer-signup"
            ? { shouldCreateUser: true, data: { account_type: "buyer", full_name: trimmedFullName, facebook_url: normalizedFacebook } }
            : { shouldCreateUser: false },
      });
      if (authError) {
        setError(mode !== "login"
          ? "No pudimos enviar el código. Revisa el número e inténtalo de nuevo."
          : "No pudimos enviar el código. Si aún no tienes cuenta, créala primero.");
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
      const { data: verified, error: authError } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
      if (authError) {
        setError("El código no es válido o expiró. Revísalo e inténtalo de nuevo.");
        return;
      }
      // Shoppers land on their account, everyone else on the panel (which also explains a
      // pending or suspended seller). Filter by the account's own id: a seller can also read
      // the buyer rows of people who reserved from her.
      let destination = nextPath;
      const userId = verified.user?.id;
      if (!destination) {
        const { data: buyer } = userId
          ? await supabase.from("buyer_profiles").select("id").eq("id", userId).maybeSingle()
          : { data: null };
        destination = buyer ? "/cuenta" : "/panel";
      }
      router.replace(destination);
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
          {mode === "buyer-signup" && (
            <>
              <label htmlFor="full-name" className="block text-xs uppercase tracking-[0.16em] text-stone-600">Tu nombre</label>
              <input id="full-name" type="text" autoComplete="name" placeholder="Ana López" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={80} required className="min-h-12 w-full border-b border-stone-400 bg-transparent px-1 text-base outline-none focus:border-stone-900" />
              <label htmlFor="facebook-url" className="block text-xs uppercase tracking-[0.16em] text-stone-600">Link de tu perfil de Facebook</label>
              <input id="facebook-url" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="https://facebook.com/tu.nombre" value={facebookUrl} onChange={(event) => setFacebookUrl(event.target.value)} required className="min-h-12 w-full border-b border-stone-400 bg-transparent px-1 text-base outline-none focus:border-stone-900" />
              <p className="text-xs leading-5 text-stone-600">Las vendedoras lo ven solo cuando les apartas una prenda, para saber con quién tratan.</p>
            </>
          )}
          {mode === "seller-signup" && (
            <>
              <label htmlFor="store-name" className="block text-xs uppercase tracking-[0.16em] text-stone-600">Nombre de tu closet</label>
              <input
                id="store-name"
                type="text"
                autoComplete="organization"
                placeholder="El closet de Ana"
                value={storeName}
                onChange={(event) => setStoreName(event.target.value)}
                maxLength={60}
                required
                className="min-h-12 w-full border-b border-stone-400 bg-transparent px-1 text-base outline-none focus:border-stone-900"
              />
            </>
          )}
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
          <button type="submit" disabled={isBusy} className="min-h-12 w-full bg-pine px-5 font-condensed text-base font-bold uppercase text-white transition-colors hover:bg-pine-light disabled:cursor-wait disabled:opacity-60">
            {isBusy ? "Enviando código…" : mode === "login" ? "Enviar código" : "Crear cuenta"}
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
          <button type="submit" disabled={isBusy} className="min-h-12 w-full bg-pine px-5 font-condensed text-base font-bold uppercase text-white transition-colors hover:bg-pine-light disabled:cursor-wait disabled:opacity-60">
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
