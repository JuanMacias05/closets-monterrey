// Web push settings and payloads. Pure, so the rules (when push is off, what a notification may
// carry) are testable without a browser or the network.

export type PushConfig = { publicKey: string; privateKey: string; subject: string };

// Push is on only with the three VAPID settings. Missing any of them is a normal state (local
// dev, a preview deploy), not an error: the app works the same, without notifications.
export function readPushConfig(env: Record<string, string | undefined>): PushConfig | null {
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  const subject = env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  if (!/^(mailto:|https:\/\/)/.test(subject)) return null;
  return { publicKey, privateKey, subject };
}

export type PushMessage = {
  title: string;
  body: string;
  // Where a tap takes her; always a path on this site.
  url: string;
  // Same tag replaces the previous notification (e.g. one per chat) instead of stacking.
  tag?: string;
};

// What the service worker (public/sw.js) receives. Short on purpose: push services cap payloads
// at about 4 KB, and a lock screen shows two lines anyway.
export function buildPushPayload(message: PushMessage): string {
  const url = message.url.startsWith("/") && !message.url.startsWith("//") ? message.url : "/";
  return JSON.stringify({
    title: truncate(message.title, 80),
    body: truncate(message.body, 160),
    url,
    tag: message.tag ? truncate(message.tag, 64) : undefined,
  });
}

function truncate(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

// The push service's answer when a subscription is gone for good (the browser unsubscribed or
// the user revoked permission): the row is deleted instead of retried forever.
export function isGoneSubscription(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410;
}

// The VAPID public key as the bytes PushManager.subscribe wants.
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}
