"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VIEW_AS_BUYER_COOKIE } from "@/features/viewer/view-as";

// Only changes how the header is drawn (getViewAsBuyer ignores it for non-admins); no server
// permission reads it.
export async function startViewingAsBuyer() {
  (await cookies()).set(VIEW_AS_BUYER_COOKIE, "1", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 8 });
  redirect("/");
}

export async function stopViewingAsBuyer() {
  (await cookies()).delete(VIEW_AS_BUYER_COOKIE);
  redirect("/panel");
}
