"use client";

import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription, type BrowserSubscription } from "@/features/push/actions";
import { urlBase64ToUint8Array } from "@/features/push/push-config";

type State = "loading" | "unsupported" | "denied" | "off" | "on";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

// "Avisos en este celular": turns web push on or off for this browser. It degrades instead of
// failing: no keys configured or a browser without push -> nothing is drawn; permission
// blocked -> it says how to unblock. Everything still shows in the app (badges, /cuenta).
export function NotificationsToggle({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function read() {
      if (!VAPID_PUBLIC_KEY || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        if (!cancelled) setState(subscription ? "on" : "off");
      } catch {
        if (!cancelled) setState("off");
      }
    }
    read();
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOn() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const subscription = (await registration.pushManager.getSubscription())
        ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));
      const result = await savePushSubscription(subscription.toJSON() as BrowserSubscription, navigator.userAgent);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setState("on");
    } catch {
      setError("Este navegador no pudo activar las notificaciones.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("off");
    } catch {
      setError("No pudimos desactivar las notificaciones.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return null;
  // In a menu there is nothing to offer; on the Avisos page she should know why.
  if (state === "unsupported") return compact ? null : <p className="text-sm text-stone-600">Este navegador no puede recibir avisos, o todavía no están configurados en la tienda.</p>;

  const text = compact ? "text-xs" : "text-sm";
  return (
    <div className={`${text} text-stone-700`}>
      {state === "denied" ? (
        <p>Bloqueaste las notificaciones de BZRS Monterrey. Para recibir avisos, permítelas en la configuración de tu navegador.</p>
      ) : state === "on" ? (
        <p className="flex flex-wrap items-center gap-x-3">
          <span>🔔 Avisos activados en este dispositivo.</span>
          <button type="button" onClick={turnOff} disabled={busy} className="min-h-11 text-stone-700 underline underline-offset-4 disabled:opacity-50">Desactivar</button>
        </p>
      ) : (
        <button type="button" onClick={turnOn} disabled={busy} className="min-h-11 text-left text-pine underline underline-offset-4 disabled:opacity-50">
          {busy ? "Activando…" : "Activar avisos en este dispositivo (mensajes y apartados)"}
        </button>
      )}
      {error && <p role="alert" className="mt-1 text-red-700">{error}</p>}
    </div>
  );
}
