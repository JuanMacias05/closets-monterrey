import { describe, expect, it } from "vitest";
import { buildPushPayload, isGoneSubscription, readPushConfig, urlBase64ToUint8Array } from "@/features/push/push-config";

describe("readPushConfig", () => {
  const env = { NEXT_PUBLIC_VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv", VAPID_SUBJECT: "mailto:hola@example.com" };
  it("is on with the three VAPID settings", () => {
    expect(readPushConfig(env)).toEqual({ publicKey: "pub", privateKey: "priv", subject: "mailto:hola@example.com" });
  });
  it("is quietly off when any is missing or the subject is not a mailto/https", () => {
    expect(readPushConfig({ ...env, VAPID_PRIVATE_KEY: undefined })).toBeNull();
    expect(readPushConfig({ ...env, NEXT_PUBLIC_VAPID_PUBLIC_KEY: " " })).toBeNull();
    expect(readPushConfig({ ...env, VAPID_SUBJECT: "hola@example.com" })).toBeNull();
  });
});

describe("buildPushPayload", () => {
  it("keeps notifications short and links only within the site", () => {
    const payload = JSON.parse(buildPushPayload({ title: "Nuevo apartado", body: "x".repeat(300), url: "https://evil.example", tag: "apartado-1" }));
    expect(payload.title).toBe("Nuevo apartado");
    expect(payload.body).toHaveLength(160);
    expect(payload.body.endsWith("…")).toBe(true);
    expect(payload.url).toBe("/");
    expect(payload.tag).toBe("apartado-1");
  });
  it("keeps a site path", () => {
    expect(JSON.parse(buildPushPayload({ title: "a", body: "b", url: "/cuenta/mensajes/1" })).url).toBe("/cuenta/mensajes/1");
    expect(JSON.parse(buildPushPayload({ title: "a", body: "b", url: "//evil.example" })).url).toBe("/");
  });
});

describe("subscriptions", () => {
  it("drops a subscription only when the push service says it is gone", () => {
    expect(isGoneSubscription(410)).toBe(true);
    expect(isGoneSubscription(404)).toBe(true);
    expect(isGoneSubscription(500)).toBe(false);
    expect(isGoneSubscription(undefined)).toBe(false);
  });
  it("decodes the VAPID key for PushManager.subscribe", () => {
    expect([...urlBase64ToUint8Array("AQID-_8")]).toEqual([1, 2, 3, 251, 255]);
  });
});
