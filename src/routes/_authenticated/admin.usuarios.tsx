import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle } from "@/components/admin/AdminShell";
import { useRoles, type Role } from "@/lib/use-roles";
import { friendlyError } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: Users,
});

const ROLES: { key: Role; label: string; desc: string }[] = [
  { key: "admin", label: "Admin", desc: "Acesso completo" },
  { key: "staff", label: "Staff", desc: "Gestão do evento" },
  { key: "checkin", label: "Check-in", desc: "Só presença" },
];

function Users() {
  const { isAdmin, isLoading } = useRoles();
  const qc = useQueryClient();
  const data = useQuery({
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
  const toggle = useMutation({
    mutationFn: async ({ userId, role, on }: { userId: string; role: Role; on: boolean }) => {
      const { error } = on
        ? await supabase.from("user_roles").insert({ user_id: userId, role })
        : await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team"] }); toast.success("Permissões atualizadas."); },
    onError: (e) => toast.error(friendlyError(e)),
  });
  const active = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from("profiles").update({ active: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
    onError: (e) => toast.error(friendlyError(e)),
  });

  if (isLoading) return null;
  if (!isAdmin) return <p className="rounded-md border bg-card p-6 text-muted-foreground">Apenas administradores podem gerenciar a equipe.</p>;

  return (
    <div>
      <PageTitle title="Equipe" />
      <p className="mb-4 text-sm text-muted-foreground">
        Novos membros criam a conta em "Acesso da equipe" e aparecem aqui. Marque as permissões para liberar o acesso.
      </p>
      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Nome / e-mail</th>
              {ROLES.map((r) => <th key={r.key} className="px-3 py-3" title={r.desc}>{r.label}</th>)}
              <th className="px-3 py-3">Ativo</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.data?.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-3"><p className="font-semibold">{u.name || "—"}</p><p className="text-xs text-muted-foreground">{u.email}</p></td>
                {ROLES.map((r) => (
                  <td key={r.key} className="px-3 py-3">
                    <input type="checkbox" className="h-5 w-5 accent-primary" checked={u.roles.includes(r.key)}
                      onChange={(e) => toggle.mutate({ userId: u.id, role: r.key, on: e.target.checked })} />
                  </td>
                ))}
                <td className="px-3 py-3">
                  <input type="checkbox" className="h-5 w-5 accent-primary" checked={u.active} onChange={(e) => active.mutate({ id: u.id, value: e.target.checked })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
