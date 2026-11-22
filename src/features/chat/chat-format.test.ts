import { describe, expect, it } from "vitest";
import { chatPhotoPath, conversationHref, conversationRoleLabel, cleanMessageBody, isChatPhotoPathFor, mergeMessages, messagePreview, messageTimeLabel, unreadLabel } from "@/features/chat/chat-format";

const message = (id: string, created_at: string) => ({ id, sender_id: "u1", body: id, created_at });

describe("mergeMessages", () => {
  it("keeps one copy of a message that arrives twice (sent + live)", () => {
    const a = message("a", "2026-11-20T10:00:00Z");
    expect(mergeMessages([a], [a])).toEqual([a]);
  });
  it("orders by time even when the live feed is out of order", () => {
    const merged = mergeMessages([message("b", "2026-11-20T10:02:00Z")], [message("c", "2026-11-20T10:03:00Z"), message("a", "2026-11-20T10:01:00Z")]);
    expect(merged.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });
});

describe("cleanMessageBody", () => {
  it("trims and accepts 1 to 1,000 characters, like the database", () => {
    expect(cleanMessageBody("  hola  ")).toBe("hola");
    expect(cleanMessageBody("   ")).toBeNull();
    expect(cleanMessageBody("x".repeat(1001))).toBeNull();
    expect(cleanMessageBody(42)).toBeNull();
  });
});

describe("chat paths and labels", () => {
  it("keeps every chat in one inbox", () => {
    expect(conversationHref("abc")).toBe("/cuenta/mensajes/abc");
  });
  it("labels each chat by what it is about, from her side", () => {
    expect(conversationRoleLabel("order", "buyer")).toBe("Como clienta");
    expect(conversationRoleLabel("order", "seller")).toBe("Como vendedora");
    expect(conversationRoleLabel("pickup", "seller")).toBe("Entrega");
    expect(conversationRoleLabel("pickup", "courier")).toBe("Entrega");
    expect(conversationRoleLabel("delivery", "buyer")).toBe("Entrega");
  });
  it("says how many are unread", () => {
    expect(unreadLabel(0)).toBeNull();
    expect(unreadLabel(1)).toBe("1 mensaje sin leer");
    expect(unreadLabel(4)).toBe("4 mensajes sin leer");
  });
  it("shows only the time for today's messages", () => {
    const now = new Date("2026-11-20T20:00:00Z");
    expect(messageTimeLabel("2026-11-20T19:05:00Z", now)).not.toMatch(/nov/);
    expect(messageTimeLabel("2026-11-18T19:05:00Z", now)).toMatch(/nov/);
  });
});

describe("chat photos", () => {
  const conversation = "11111111-1111-4111-8111-111111111111";
  const photo = "22222222-2222-4222-8222-222222222222";

  it("stores a photo in its conversation's folder", () => {
    expect(chatPhotoPath(conversation, photo)).toBe(`${conversation}/${photo}.jpg`);
  });

  it("accepts only a JPEG path inside this conversation", () => {
    expect(isChatPhotoPathFor(conversation, `${conversation}/${photo}.jpg`)).toBe(true);
    expect(isChatPhotoPathFor(conversation, `${photo}/${photo}.jpg`)).toBe(false);
    expect(isChatPhotoPathFor(conversation, `${conversation}/${photo}.png`)).toBe(false);
    expect(isChatPhotoPathFor(conversation, `${conversation}/../x.jpg`)).toBe(false);
    expect(isChatPhotoPathFor(conversation, null)).toBe(false);
  });

  it("previews a photo without text as 📷 Foto", () => {
    expect(messagePreview(null, true)).toBe("📷 Foto");
    expect(messagePreview("  ", true)).toBe("📷 Foto");
    expect(messagePreview("Mira la mancha", true)).toBe("Mira la mancha");
    expect(messagePreview("Hola", false)).toBe("Hola");
  });
});
