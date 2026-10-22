import { useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle } from "@/components/admin/AdminShell";
import { Input } from "@/components/ui/input";
import { useRoles, type Role } from "@/lib/use-roles";
import { formatDateTime, friendlyError } from "@/lib/format";
import { inviteStaff, listMemberActivity, resendInvite, setMemberAccess } from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: Users,
});

const ROLES: { key: Role; label: string; desc: string }[] = [
  { key: "admin", label: "Admin", desc: "Acesso completo" },
  { key: "staff", label: "Staff", desc: "Gestão do evento" },
  { key: "checkin", label: "Check-in", desc: "Só presença" },
];

const INVITE_LABEL: Record<string, string> = { pending: "Pendente", accepted: "Aceito", revoked: "Cancelado", expired: "Expirado" };

function Users() {
  const { isAdmin, isLoading, data: me } = useRoles();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "norole">("all");

  const invite = useServerFn(inviteStaff);
  const resend = useServerFn(resendInvite);
  const setAccess = useServerFn(setMemberAccess);
  const activityFn = useServerFn(listMemberActivity);

  const team = useQuery({
    queryKey: ["team"],
    enabled: isAdmin,
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (profiles ?? []).map((p) => ({ ...p, roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as Role) }));
    },
  });
  const activity = useQuery({ queryKey: ["team-activity"], enabled: isAdmin, queryFn: () => activityFn() });
  const invites = useQuery({
    queryKey: ["invites"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_invites").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ userId, role, on }: { userId: string; role: Role; on: boolean }) => {
      const { error } = on
        ? await supabase.from("user_roles").insert({ user_id: userId, role })
        : await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team"] }); toast.success("Permissões atualizadas."); },
    onError: (e) => { qc.invalidateQueries({ queryKey: ["team"] }); toast.error(friendlyError(e)); },
  });
  const access = useMutation({
    mutationFn: (v: { userId: string; active: boolean }) => setAccess({ data: v }),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ["team"] }); toast.success(v.active ? "Acesso reativado." : "Acesso encerrado."); },
    onError: (e) => toast.error(friendlyError(e)),
  });
  const sendInvite = useMutation({
    mutationFn: (v: { email: string; name: string; role: Role }) => invite({ data: { ...v, origin: window.location.origin } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invites"] }); toast.success("Convite enviado por e-mail."); },
    onError: (e) => { qc.invalidateQueries({ queryKey: ["invites"] }); toast.error(friendlyError(e)); },
  });
  const resendMut = useMutation({
    mutationFn: (id: string) => resend({ data: { id, origin: window.location.origin } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invites"] }); toast.success("Convite reenviado (válido por mais 24h)."); },
    onError: (e) => toast.error(friendlyError(e)),
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff_invites").update({ status: "revoked" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invites"] }); toast.success("Convite cancelado."); },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const [form, setForm] = useState({ email: "", name: "", role: "checkin" as Role });
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.email.trim()) return;
    sendInvite.mutate(form, { onSuccess: () => setForm({ email: "", name: "", role: "checkin" }) });
  }

  const members = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (team.data ?? []).filter((u) => {
      if (q && !`${u.name ?? ""} ${u.email ?? ""}`.toLowerCase().includes(q)) return false;
      if (filter === "active") return u.active;
      if (filter === "inactive") return !u.active;
      if (filter === "norole") return u.roles.length === 0;
      return true;
    });
  }, [team.data, search, filter]);

  if (isLoading) return null;
  if (!isAdmin) return <p className="rounded-md border bg-card p-6 text-muted-foreground">Apenas administradores podem gerenciar a equipe.</p>;

  const myEmail = me?.email;
  const sel = "h-11 rounded-md border bg-card px-3 text-sm";
  const now = Date.now();

  return (
    <div className="space-y-8">
      <PageTitle title="Equipe" />

      <section className="rounded-md border bg-card p-4">
        <h2 className="text-xl font-bold uppercase">Convidar membro</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          O cadastro público está desligado. A pessoa recebe um link por e-mail (válido por 24h, uso único), define a própria senha e entra já com o cargo escolhido.
        </p>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
          <Input className="h-11" placeholder="Nome" value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input className="h-11" type="email" required placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <select className={sel} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label} — {r.desc}</option>)}
          </select>
          <button disabled={sendInvite.isPending} className="h-11 rounded-md bg-primary px-5 font-display font-bold uppercase text-primary-foreground disabled:opacity-60">
            {sendInvite.isPending ? "Enviando..." : "Enviar convite"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold uppercase">Convites</h2>
        <div className="overflow-x-auto rounded-md border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-3">E-mail</th><th className="px-3 py-3">Cargo</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Validade</th><th className="px-3 py-3"></th></tr>
            </thead>
            <tbody className="divide-y">
              {(invites.data ?? []).length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-muted-foreground">Nenhum convite.</td></tr>}
              {invites.data?.map((i) => {
                const status = i.status === "pending" && new Date(i.expires_at).getTime() < now ? "expired" : i.status;
                return (
                  <tr key={i.id}>
                    <td className="px-3 py-3"><p className="font-semibold">{i.name || "—"}</p><p className="text-xs text-muted-foreground">{i.email}</p></td>
                    <td className="px-3 py-3">{ROLES.find((r) => r.key === i.role)?.label}</td>
                    <td className="px-3 py-3">{INVITE_LABEL[status]}</td>
                    <td className="px-3 py-3 text-xs">{formatDateTime(i.expires_at)}</td>
                    <td className="px-3 py-3 text-right">
                      {i.status === "pending" && (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => resendMut.mutate(i.id)} className="rounded border px-3 py-1.5 text-xs">Reenviar</button>
                          <button onClick={() => revoke.mutate(i.id)} className="rounded border border-destructive px-3 py-1.5 text-xs text-destructive">Cancelar</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="mr-auto text-xl font-bold uppercase">Membros</h2>
          <Input className="h-11 w-56" placeholder="Buscar nome ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className={sel} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">Todos</option><option value="active">Ativos</option><option value="inactive">Desativados</option><option value="norole">Sem permissão</option>
          </select>
        </div>
        <div className="overflow-x-auto rounded-md border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Nome / e-mail</th>
                {ROLES.map((r) => <th key={r.key} className="px-3 py-3" title={r.desc}>{r.label}</th>)}
                <th className="px-3 py-3">Último acesso</th>
                <th className="px-3 py-3">Acesso</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((u) => {
                const isMe = u.email === myEmail;
                const last = activity.data?.[u.id];
                const stale = !last || now - new Date(last).getTime() > 60 * 86400000;
                return (
                  <tr key={u.id} className={u.active ? "" : "opacity-60"}>
                    <td className="px-3 py-3"><p className="font-semibold">{u.name || "—"}{isMe && " (você)"}</p><p className="text-xs text-muted-foreground">{u.email}</p></td>
                    {ROLES.map((r) => (
                      <td key={r.key} className="px-3 py-3">
                        <input type="checkbox" className="h-5 w-5 accent-primary" checked={u.roles.includes(r.key)}
                          disabled={isMe && r.key === "admin"}
                          onChange={(e) => toggle.mutate({ userId: u.id, role: r.key, on: e.target.checked })} />
                      </td>
                    ))}
                    <td className={`px-3 py-3 text-xs ${stale ? "text-destructive" : ""}`}>{last ? formatDateTime(last) : "Nunca"}</td>
                    <td className="px-3 py-3">
                      {isMe ? <span className="text-xs text-muted-foreground">—</span> : (
                        <button onClick={() => access.mutate({ userId: u.id, active: !u.active })}
                          className={`rounded border px-3 py-1.5 text-xs ${u.active ? "border-destructive text-destructive" : ""}`}>
                          {u.active ? "Encerrar acesso" : "Reativar"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">"Encerrar acesso" bloqueia o login e corta as permissões na hora. Último acesso em vermelho: mais de 60 dias sem entrar.</p>
      </section>
    </div>
  );
}
