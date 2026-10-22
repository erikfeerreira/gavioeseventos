import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle } from "@/components/admin/AdminShell";
import { useRoles } from "@/lib/use-roles";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/historico")({
  component: History,
});

const ACTION: Record<string, string> = {
  invite_created: "Convite enviado",
  invite_resent: "Convite reenviado",
  invite_revoked: "Convite cancelado",
  invite_accepted: "Convite aceito",
  role_added: "Permissão concedida",
  role_removed: "Permissão removida",
  account_activated: "Conta reativada",
  account_deactivated: "Acesso encerrado",
  registration_status: "Status de inscrição",
  export: "Exportação de dados",
};

function History() {
  const { isAdmin, isLoading } = useRoles();
  const [action, setAction] = useState("");
  const log = useQuery({
    queryKey: ["audit", action],
    enabled: isAdmin,
    queryFn: async () => {
      let q = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(300);
      if (action) q = q.eq("action", action);
      const [{ data, error }, { data: profiles }] = await Promise.all([q, supabase.from("profiles").select("id, name, email")]);
      if (error) throw error;
      const who = (id: string | null) => {
        const p = profiles?.find((x) => x.id === id);
        return p ? p.name || p.email : id ? "—" : "Sistema";
      };
      return (data ?? []).map((r) => ({ ...r, actor: who(r.actor_id), targetLabel: profiles?.find((x) => x.id === r.target)?.email ?? r.target }));
    },
  });

  if (isLoading) return null;
  if (!isAdmin) return <p className="rounded-md border bg-card p-6 text-muted-foreground">Apenas administradores podem ver o histórico.</p>;

  return (
    <div>
      <PageTitle title="Histórico">
        <select className="h-11 rounded-md border bg-card px-3 text-sm" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Todas as ações</option>
          {Object.entries(ACTION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </PageTitle>
      <p className="mb-4 text-sm text-muted-foreground">Registro permanente das ações da equipe. Ninguém pode editar ou apagar estes registros.</p>
      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-3">Data</th><th className="px-3 py-3">Quem</th><th className="px-3 py-3">Ação</th><th className="px-3 py-3">Alvo</th><th className="px-3 py-3">Detalhes</th></tr>
          </thead>
          <tbody className="divide-y">
            {(log.data ?? []).length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-muted-foreground">Nenhum registro ainda.</td></tr>}
            {log.data?.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-3 text-xs">{formatDateTime(r.created_at)}</td>
                <td className="px-3 py-3">{r.actor}</td>
                <td className="px-3 py-3">{ACTION[r.action] ?? r.action}</td>
                <td className="px-3 py-3 text-xs">{r.targetLabel}</td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{Object.entries((r.details as Record<string, unknown>) ?? {}).map(([k, v]) => `${k}: ${String(v)}`).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
