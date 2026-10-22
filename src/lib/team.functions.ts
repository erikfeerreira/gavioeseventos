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
      const link = await makeLink(supabaseAdmin, data.email, data.name, redirectTo);
      if (!link) {
        await (context as Ctx).supabase.from("staff_invites").update({ status: "revoked" }).eq("id", inv.id);
        throw new Error("LINK_FAILED");
      }
      return { ok: true, link };
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

/** One-time access link (invite, or magic link when the account already exists but never confirmed). */
async function makeLink(admin: any, email: string, name: string, redirectTo: string): Promise<string | null> {
  const inv = await admin.auth.admin.generateLink({ type: "invite", email, options: { redirectTo, data: { name } } });
  if (!inv.error && inv.data?.properties?.action_link) return inv.data.properties.action_link;
  const ml = await admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
  if (!ml.error && ml.data?.properties?.action_link) return ml.data.properties.action_link;
  console.error("generateLink failed", inv.error?.message, ml.error?.message);
  return null;
}

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
    const { error } = await sb.from("staff_invites").update({ send_count: inv.send_count + 1 }).eq("id", inv.id);
    if (error) throw new Error(String(error.message).includes("RATE_LIMIT") ? "RATE_LIMIT" : "INVITE_FAILED");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const link = await makeLink(supabaseAdmin, inv.email, inv.name ?? "", redirectUrl() ?? `${data.origin}/definir-senha`);
    if (!link) throw new Error("LINK_FAILED");
    return { link };
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
