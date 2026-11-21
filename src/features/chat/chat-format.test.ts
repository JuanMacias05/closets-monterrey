import { describe, expect, it } from "vitest";
import { chatBasePath, cleanMessageBody, mergeMessages, messageTimeLabel, unreadLabel } from "@/features/chat/chat-format";

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
  it("keeps each area's chats inside that area", () => {
    expect(chatBasePath("buyer")).toBe("/cuenta/mensajes");
    expect(chatBasePath("seller")).toBe("/panel/mensajes");
    expect(chatBasePath("courier")).toBe("/recolectora/mensajes");
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
