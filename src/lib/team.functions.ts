import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || data !== true) throw new Error("FORBIDDEN");
}

const ROLES = ["admin", "staff", "checkin"] as const;
type Role = (typeof ROLES)[number];

function redirectUrl() {
  const origin = process.env["PUBLIC_SITE_URL"];
  return origin ? `${origin}/definir-senha` : undefined;
}

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; name: string; role: Role; origin: string; delivery?: "email" | "link" }) => {
    const email = String(input?.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) throw new Error("INVALID_EMAIL");
    if (!ROLES.includes(input?.role)) throw new Error("INVALID_ROLE");
    const origin = String(input?.origin ?? "");
    if (!/^https?:\/\/[^/]+$/.test(origin)) throw new Error("INVALID_ORIGIN");
    return { email, name: String(input?.name ?? "").trim().slice(0, 120), role: input.role, origin, delivery: input?.delivery === "link" ? "link" : "email" };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Insert under the admin's own session so RLS + DB triggers validate and audit it
    const { data: inv, error } = await (context as Ctx).supabase
      .from("staff_invites")
      .insert({ email: data.email, name: data.name, role: data.role })
      .select("id")
      .single();
    if (error) {
      if (String(error.message).includes("staff_invites_one_pending")) throw new Error("ALREADY_PENDING");
      if (String(error.message).includes("RATE_LIMIT")) throw new Error("RATE_LIMIT");
      throw new Error("INVITE_FAILED");
    }
    const redirectTo = redirectUrl() ?? `${data.origin}/definir-senha`;
    if (data.delivery === "link") {
      const token = newToken();
      const { error: tErr } = await (context as Ctx).supabase
        .from("staff_invites").update({ token_hash: await sha256(token) }).eq("id", inv.id);
      if (tErr) throw new Error("LINK_FAILED");
      return { ok: true, link: `${data.origin}/convite/${token}` };
    }
    const { error: sendErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo,
      data: { name: data.name },
    });
    if (sendErr) {
      console.error("invite send failed", sendErr.message);
      await (context as Ctx).supabase.from("staff_invites").update({ status: "revoked" }).eq("id", inv.id);
      throw new Error(sendErr.message.toLowerCase().includes("already") ? "USER_EXISTS" : "SEND_FAILED");
    }
    return { ok: true, link: null as string | null };
  });

function newToken() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function sha256(s: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(h)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** New single-use link for a pending invite; the previous link stops working. */
export const getInviteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; origin: string }) => {
    const origin = String(input?.origin ?? "");
    if (!/^https?:\/\/[^/]+$/.test(origin)) throw new Error("INVALID_ORIGIN");
    return { id: String(input?.id ?? ""), origin };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const sb = (context as Ctx).supabase;
    const { data: inv } = await sb.from("staff_invites").select("*").eq("id", data.id).single();
    if (!inv || inv.status !== "pending") throw new Error("INVITE_CLOSED");
    const token = newToken();
    const { error } = await sb.from("staff_invites")
      .update({ send_count: inv.send_count + 1, token_hash: await sha256(token) }).eq("id", inv.id);
    if (error) throw new Error(String(error.message).includes("RATE_LIMIT") ? "RATE_LIMIT" : "INVITE_FAILED");
    return { link: `${data.origin}/convite/${token}` };
  });

async function findInvite(token: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("staff_invites").select("*")
    .eq("token_hash", await sha256(token)).eq("status", "pending").gt("expires_at", new Date().toISOString()).maybeSingle();
  return data ? { inv: data, admin: supabaseAdmin } : null;
}

/** Public: shows who the link is for (only while valid). */
export const checkInviteToken = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => ({ token: String(input?.token ?? "") }))
  .handler(async ({ data }) => {
    const f = await findInvite(data.token);
    return f ? { valid: true as const, email: f.inv.email as string, name: (f.inv.name ?? "") as string } : { valid: false as const };
  });

/** Public: the invited person sets their password; account is created confirmed and gets the invited role. */
export const acceptInviteToken = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; password: string; name: string }) => {
    const password = String(input?.password ?? "");
    if (password.length < 8 || password.length > 72) throw new Error("WEAK_PASSWORD");
    return { token: String(input?.token ?? ""), password, name: String(input?.name ?? "").trim().slice(0, 120) };
  })
  .handler(async ({ data }) => {
    const f = await findInvite(data.token);
    if (!f) throw new Error("INVITE_INVALID");
    const { inv, admin } = f;
    const name = data.name || inv.name || "";
    let userId: string;
    const created = await admin.auth.admin.createUser({
      email: inv.email, password: data.password, email_confirm: true, user_metadata: { name },
    });
    if (created.data?.user) {
      userId = created.data.user.id;
    } else {
      // Account left over from an e-mail invite that was never confirmed
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const existing = list?.users?.find((u) => (u.email ?? "").toLowerCase() === inv.email);
      if (!existing || existing.email_confirmed_at) throw new Error("USER_EXISTS");
      const upd = await admin.auth.admin.updateUserById(existing.id, { password: data.password, email_confirm: true, user_metadata: { name } });
      if (upd.error) throw new Error("ACCEPT_FAILED");
      userId = existing.id;
    }
    // Claim the invite once (only if still pending), then apply the role stored in the invite
    const { data: claimed } = await admin.from("staff_invites")
      .update({ status: "accepted", accepted_at: new Date().toISOString(), token_hash: null })
      .eq("id", inv.id).eq("status", "pending").select("id");
    const { data: roleRow } = await admin.from("user_roles").select("id").eq("user_id", userId).eq("role", inv.role).maybeSingle();
    if ((claimed && claimed.length) || !roleRow) {
      if (!roleRow) await admin.from("user_roles").insert({ user_id: userId, role: inv.role });
    }
    await admin.from("profiles").update({ name }).eq("id", userId).eq("name", "");
    return { ok: true, email: inv.email as string };
  });

export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; origin: string }) => {
    const origin = String(input?.origin ?? "");
    if (!/^https?:\/\/[^/]+$/.test(origin)) throw new Error("INVALID_ORIGIN");
    return { id: String(input?.id ?? ""), origin };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const sb = (context as Ctx).supabase;
    const { data: inv } = await sb.from("staff_invites").select("*").eq("id", data.id).single();
    if (!inv || inv.status !== "pending") throw new Error("INVITE_CLOSED");
    const { error } = await sb.from("staff_invites").update({ send_count: inv.send_count + 1 }).eq("id", inv.id);
    if (error) throw new Error(String(error.message).includes("RATE_LIMIT") ? "RATE_LIMIT" : "INVITE_FAILED");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: sendErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(inv.email, {
      redirectTo: redirectUrl() ?? `${data.origin}/definir-senha`,
      data: { name: inv.name ?? "" },
    });
    if (sendErr) {
      console.error("invite resend failed", sendErr.message);
      throw new Error("SEND_FAILED");
    }
    return { ok: true };
  });

/** Deactivate/reactivate a member and block/unblock their login (ends sessions on next token refresh). */
export const setMemberAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; active: boolean }) => ({
    userId: String(input?.userId ?? ""),
    active: Boolean(input?.active),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    // DB trigger blocks self-deactivation and removing the last admin
    const { error } = await (context as Ctx).supabase.from("profiles").update({ active: data.active }).eq("id", data.userId);
    if (error) {
      const m = String(error.message);
      throw new Error(m.includes("LAST_ADMIN") ? "LAST_ADMIN" : m.includes("SELF_DEACTIVATE") ? "SELF_DEACTIVATE" : "UPDATE_FAILED");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.active ? "none" : "876000h",
    });
    if (banErr) console.error("ban update failed", banErr.message);
    return { ok: true };
  });

export const listMemberActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) return {} as Record<string, string | null>;
    const out: Record<string, string | null> = {};
    for (const u of data.users) out[u.id] = u.last_sign_in_at ?? null;
    return out;
  });
