import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle, RequireManager } from "@/components/admin/AdminShell";
import { EventSelect, useEventsList } from "@/components/admin/EventSelect";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, formatDate, formatDateTime, friendlyError, maskCpf, maskPhone, onlyDigits } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/participantes")({
  component: () => (
    <RequireManager>
      <ParticipantTable />
    </RequireManager>
  ),
});

type Row = {
  id: string;
  event_id: string;
  registration_code: string;
  food_item: string | null;
  registration_status: "inscrito" | "cancelado" | "checkin" | "ausente";
  registered_at: string;
  checked_in_at: string | null;
  participants: { first_name: string; last_name: string; cpf: string; birth_date: string; whatsapp: string | null } | null;
};

const PAGE = 20;

function ParticipantTable() {
  const qc = useQueryClient();
  const events = useEventsList();
  const [eventId, setEventId] = useState("");
  const [status, setStatus] = useState("");
  const [presence, setPresence] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"registered_at" | "name">("registered_at");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const first = events.data?.[0];
    if (!eventId && first) setEventId(first.id);
  }, [events.data, eventId]);

  const regs = useQuery({
    queryKey: ["participants", eventId],
    enabled: events.isSuccess,
    queryFn: async () => {
      let query = supabase
        .from("registrations")
        .select("id, event_id, registration_code, food_item, registration_status, registered_at, checked_in_at, participants(first_name,last_name,cpf,birth_date,whatsapp)")
        .order("registered_at", { ascending: false })
        .limit(10000);
      if (eventId) query = query.eq("event_id", eventId);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const setStatusMut = useMutation({
    mutationFn: async ({ id, s }: { id: string; s: Row["registration_status"] }) => {
      const { error } = await supabase.from("registrations").update({ registration_status: s }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["participants"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Status atualizado.");
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = onlyDigits(q);
    let list = (regs.data ?? []).filter((r) => {
      if (status && r.registration_status !== status) return false;
      if (presence === "sim" && !r.checked_in_at) return false;
      if (presence === "nao" && r.checked_in_at) return false;
      if (!term) return true;
      const p = r.participants;
      const name = `${p?.first_name} ${p?.last_name}`.toLowerCase();
      return name.includes(term) || r.registration_code.toLowerCase().includes(term) ||
        (digits.length >= 3 && ((p?.cpf ?? "").includes(digits) || (p?.whatsapp ?? "").includes(digits)));
    });
    if (sort === "name") list = [...list].sort((a, b) => `${a.participants?.first_name} ${a.participants?.last_name}`.localeCompare(`${b.participants?.first_name} ${b.participants?.last_name}`, "pt-BR"));
    return list;
  }, [regs.data, q, status, presence, sort]);

  useEffect(() => setPage(0), [q, status, presence, eventId]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice(page * PAGE, page * PAGE + PAGE);

  function exportCsv() {
    const evName = (id: string) => events.data?.find((e) => e.id === id)?.name ?? "";
    const header = ["Evento", "Código", "Nome", "Sobrenome", "CPF", "WhatsApp", "Nascimento", "Alimento", "Status", "Check-in", "Inscrição"];
    const esc = (v: string | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const lines = filtered.map((r) => [
      evName(r.event_id), r.registration_code, r.participants?.first_name ?? "", r.participants?.last_name ?? "",
      r.participants?.cpf ?? "", r.participants?.whatsapp ?? "", formatDate(r.participants?.birth_date) ?? "",
      r.food_item ?? "", STATUS_LABEL[r.registration_status], r.checked_in_at ? formatDateTime(r.checked_in_at) : "", formatDateTime(r.registered_at),
    ].map(esc).join(";"));
    const blob = new Blob(["\uFEFF" + [header.map(esc).join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `participantes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const sel = "h-11 rounded-md border bg-card px-3 text-sm";
  return (
    <div>
      <PageTitle title="Participantes">
        <button onClick={exportCsv} disabled={!filtered.length} className="h-11 rounded-md bg-ink px-4 font-display uppercase tracking-wide text-ink-foreground disabled:opacity-50">
          Exportar CSV
        </button>
      </PageTitle>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="Buscar nome, CPF, WhatsApp ou código" value={q} onChange={(e) => setQ(e.target.value)} className="h-11 max-w-sm" />
        <EventSelect value={eventId} onChange={setEventId} allowAll />
        <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={sel} value={presence} onChange={(e) => setPresence(e.target.value)}>
          <option value="">Presença: todos</option>
          <option value="sim">Compareceu</option>
          <option value="nao">Não compareceu</option>
        </select>
        <select className={sel} value={sort} onChange={(e) => setSort(e.target.value as "registered_at" | "name")}>
          <option value="registered_at">Mais recentes</option>
          <option value="name">Nome (A-Z)</option>
        </select>
      </div>
      <p className="mb-2 text-sm text-muted-foreground">{filtered.length} resultado(s)</p>
      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {["Nome", "CPF", "WhatsApp", "Nascimento", "Alimento", "Status", "Check-in", "Inscrição", ""].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {regs.isLoading && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
            {!regs.isLoading && !rows.length && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Nenhum participante encontrado.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-3 font-semibold">{r.participants?.first_name} {r.participants?.last_name}<div className="text-xs font-normal text-muted-foreground">{r.registration_code}</div></td>
                <td className="px-3 py-3 font-mono text-xs">{maskCpf(r.participants?.cpf ?? "")}</td>
                <td className="px-3 py-3 font-mono text-xs">{maskPhone(r.participants?.whatsapp)}</td>
                <td className="px-3 py-3">{formatDate(r.participants?.birth_date)}</td>
                <td className="px-3 py-3">{r.food_item || "—"}</td>
                <td className="px-3 py-3"><Badge variant={r.registration_status === "checkin" ? "default" : "secondary"}>{STATUS_LABEL[r.registration_status]}</Badge></td>
                <td className="px-3 py-3">{r.checked_in_at ? formatDateTime(r.checked_in_at) : "—"}</td>
                <td className="px-3 py-3">{formatDateTime(r.registered_at)}</td>
                <td className="px-3 py-3">
                  {r.registration_status !== "checkin" && (
                    <select
                      aria-label="Alterar status"
                      className="h-9 rounded border bg-card px-2 text-xs"
                      value={r.registration_status}
                      onChange={(e) => setStatusMut.mutate({ id: r.id, s: e.target.value as Row["registration_status"] })}
                    >
                      <option value="inscrito">Inscrito</option>
                      <option value="cancelado">Cancelado</option>
                      <option value="ausente">Ausente</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2 text-sm">
        <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded border px-3 py-2 disabled:opacity-40">Anterior</button>
        <span>Página {page + 1} de {pages}</span>
        <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded border px-3 py-2 disabled:opacity-40">Próxima</button>
      </div>
    </div>
  );
}
