"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatNationalMX, nationalDigitsMX, normalizePhoneE164 } from "@/features/auth/phone-number";
import { isValidFacebookUrl, normalizeFacebookUrl } from "@/features/shop/facebook-url";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// "login" refuses unknown numbers so a typo doesn't silently create a second account.
// "buyer-signup" creates a shopper (name + Facebook link, no approval needed).
// "seller-signup" creates a pending seller who can't sell until an admin approves her from
// /panel/admin/vendedoras.
// Every SMS costs money (Twilio bills each code), so a code can't be re-sent until this has
// passed. Supabase has its own server-side limit; this one keeps an impatient double tap from
// reaching it.
const RESEND_COOLDOWN_SECONDS = 60;

// `onVerified`: sign-up asks one more question after the code (registro), so it takes over
// instead of redirecting.
export function PhoneLoginForm({ mode = "login", nextPath, onVerified }: {
  mode?: "login" | "buyer-signup" | "seller-signup" | "courier-signup";
  nextPath?: string;
  onVerified?: () => void;
}) {
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
  const [lastSent, setLastSent] = useState<{ phone: string; at: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!lastSent) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [lastSent]);

  function cooldownLeft(forPhone: string) {
    if (!lastSent || lastSent.phone !== forPhone) return 0;
    return Math.max(0, RESEND_COOLDOWN_SECONDS - Math.floor((now - lastSent.at) / 1000));
  }

  async function requestCode(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError(null);
    const normalizedPhone = phoneInput.length === 10 ? normalizePhoneE164(phoneInput) : null;
    if (!normalizedPhone) {
      setError("Escribe los 10 dígitos de tu celular, por ejemplo 81 2345 6789.");
      return;
    }
    if (cooldownLeft(normalizedPhone) > 0) {
      setStep("otp");
      return;
    }
    const trimmedStoreName = storeName.trim();
    if (mode === "seller-signup" && (trimmedStoreName.length === 0 || trimmedStoreName.length > 60)) {
      setError("Escribe el nombre de tu bazar (máximo 60 caracteres).");
      return;
    }
    const trimmedFullName = fullName.trim();
    const normalizedFacebook = normalizeFacebookUrl(facebookUrl);
    if (mode === "courier-signup" && (trimmedFullName.length < 2 || trimmedFullName.length > 80)) {
      setError("Escribe tu nombre (2 a 80 caracteres).");
      return;
    }
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
          : mode === "courier-signup"
            ? { shouldCreateUser: true, data: { account_type: "courier", full_name: trimmedFullName } }
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
      setLastSent({ phone: normalizedPhone, at: Date.now() });
      setNow(Date.now());
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
      if (onVerified) {
        onVerified();
        return;
      }
      // Sellers and admins land on the panel (which also explains a pending or suspended store),
      // couriers on their deliveries, everyone else on her account. Filter by the account's own
      // id: a seller can also read the buyer rows of people who reserved from her.
      let destination = nextPath;
      const userId = verified.user?.id;
      if (!destination) {
        const [{ data: store }, { data: admin }, { data: courier }] = userId
          ? await Promise.all([
            supabase.from("profiles").select("id").eq("id", userId).maybeSingle(),
            supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle(),
            supabase.from("couriers").select("id").eq("id", userId).maybeSingle(),
          ])
          : [{ data: null }, { data: null }, { data: null }];
        destination = store || admin ? "/panel" : courier ? "/recolectora" : "/cuenta";
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
              <p className="text-xs leading-5 text-stone-600">Las tiendas lo ven solo cuando les apartas una prenda, para saber con quién tratan.</p>
            </>
          )}
          {mode === "courier-signup" && (
            <>
              <label htmlFor="courier-name" className="block text-xs uppercase tracking-[0.16em] text-stone-600">Tu nombre completo</label>
              <input id="courier-name" type="text" autoComplete="name" placeholder="Guadalupe Martínez" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={80} required className="min-h-12 w-full border-b border-stone-400 bg-transparent px-1 text-base outline-none focus:border-stone-900" />
            </>
          )}
          {mode === "seller-signup" && (
            <>
              <label htmlFor="store-name" className="block text-xs uppercase tracking-[0.16em] text-stone-600">Nombre de tu bazar</label>
              <input
                id="store-name"
                type="text"
                autoComplete="organization"
                placeholder="El bazar de Ana"
                value={storeName}
                onChange={(event) => setStoreName(event.target.value)}
                maxLength={60}
                required
                className="min-h-12 w-full border-b border-stone-400 bg-transparent px-1 text-base outline-none focus:border-stone-900"
              />
            </>
          )}
          <label htmlFor="phone" className="block text-xs uppercase tracking-[0.16em] text-stone-600">Número de celular</label>
          <div className="flex items-center border-b border-stone-400 focus-within:border-stone-900">
            <span aria-hidden="true" className="select-none pl-1 pr-2 text-base text-stone-500">+52</span>
            <input
              id="phone"
              type="tel"
              autoComplete="tel-national"
              inputMode="numeric"
              placeholder="81 2345 6789"
              aria-describedby="phone-hint"
              value={formatNationalMX(phoneInput)}
              onChange={(event) => setPhoneInput(nationalDigitsMX(event.target.value))}
              required
              className="min-h-12 w-full min-w-0 bg-transparent px-1 text-base tracking-wide outline-none"
            />
          </div>
          <p id="phone-hint" className="-mt-3 text-xs text-stone-500">Celular de México, 10 dígitos.</p>
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
          <div className="flex gap-3">
            <button type="button" onClick={() => { setStep("phone"); setOtp(""); setError(null); }} className="min-h-11 flex-1 text-xs uppercase tracking-[0.14em] text-stone-600 underline underline-offset-4">
              Cambiar número
            </button>
            <button type="button" disabled={isBusy || cooldownLeft(phone) > 0} onClick={() => requestCode()} className="min-h-11 flex-1 text-xs uppercase tracking-[0.14em] text-stone-600 underline underline-offset-4 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60">
              {cooldownLeft(phone) > 0 ? `Reenviar en ${cooldownLeft(phone)} s` : "Reenviar código"}
            </button>
          </div>
        </form>
      )}

      {error && <p role="alert" className="mt-4 text-sm leading-5 text-red-700">{error}</p>}
    </div>
  );
}
