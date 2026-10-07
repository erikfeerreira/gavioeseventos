import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { EventSelect, useEventsList } from "@/components/admin/EventSelect";
import { Input } from "@/components/ui/input";
import { STATUS_LABEL, friendlyError, maskCpf, onlyDigits } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/checkin")({
  validateSearch: z.object({ codigo: z.string().optional() }),
  head: () => ({ meta: [{ title: "Check-in | Gaviões Eventos" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AdminShell>
      <CheckIn />
    </AdminShell>
  ),
});

type Hit = {
  id: string;
  event_id: string;
  registration_code: string;
  food_item: string | null;
  registration_status: "inscrito" | "cancelado" | "checkin" | "ausente";
  checked_in_at: string | null;
  participants: { first_name: string; last_name: string; cpf: string; whatsapp: string | null } | null;
};

function CheckIn() {
  const { codigo } = Route.useSearch();
  const events = useEventsList();
  const [eventId, setEventId] = useState("");
  const [term, setTerm] = useState(codigo ?? "");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; kind: "ok" | "already" } | null>(null);

  useEffect(() => {
    if (!eventId && events.data?.length) {
      const open = events.data.find((e) => e.status === "published") ?? events.data[0];
      setEventId(open.id);
    }
  }, [events.data, eventId]);

  useEffect(() => {
    if (codigo && eventId) void search(codigo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo, eventId]);

  async function search(raw: string) {
    const t = raw.trim();
    setError(null);
    setResult(null);
    if (t.length < 2) return setError("Digite pelo menos 2 caracteres.");
    setLoading(true);
    const sel = "id, event_id, registration_code, food_item, registration_status, checked_in_at, participants!inner(first_name,last_name,cpf,whatsapp)";
    const digits = onlyDigits(t);
    let q = supabase.from("registrations").select(sel).eq("event_id", eventId).limit(20);
    if (/^[0-9A-Fa-f]{8}$/.test(t) && /[A-Fa-f]/.test(t)) {
      q = q.eq("registration_code", t.toUpperCase());
    } else if (digits.length >= 4 && digits.length === t.replace(/[\s.\-()]/g, "").length) {
      q = q.or(`cpf.like.%${digits}%,whatsapp.like.%${digits}%`, { referencedTable: "participants" });
    } else {
      const safe = t.replace(/[%,()]/g, " ");
      const [first, ...rest] = safe.split(/\s+/);
      q = rest.length
        ? q.ilike("participants.first_name", `%${first}%`).ilike("participants.last_name", `%${rest.join(" ")}%`)
        : q.or(`first_name.ilike.%${first}%,last_name.ilike.%${first}%`, { referencedTable: "participants" });
    }
    let { data, error: err } = await q;
    if (!err && !data?.length && /^[0-9A-Fa-f]{8}$/.test(t)) {
      ({ data, error: err } = await supabase.from("registrations").select(sel).eq("event_id", eventId).eq("registration_code", t.toUpperCase()));
    }
    setLoading(false);
    if (err) return setError(friendlyError(err));
    setHits((data ?? []) as unknown as Hit[]);
  }

  async function confirm(h: Hit) {
    setError(null);
    const { data, error: err } = await supabase.rpc("confirm_checkin", { _registration_id: h.id });
    if (err) return setError(friendlyError(err));
    setResult({ id: h.id, kind: data === "ALREADY" ? "already" : "ok" });
    setHits((prev) => prev?.map((x) => (x.id === h.id ? { ...x, registration_status: "checkin", checked_in_at: x.checked_in_at ?? new Date().toISOString() } : x)) ?? null);
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void search(term);
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h1 className="text-5xl font-extrabold uppercase italic">Check-in</h1>
        <EventSelect value={eventId} onChange={(v) => { setEventId(v); setHits(null); }} />
      </div>
      <form onSubmit={onSubmit} className="flex gap-2">
        <Input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Digite CPF, nome ou WhatsApp" className="h-14 text-lg" />
        <button className="h-14 rounded-md bg-ink px-5 font-display text-lg uppercase text-ink-foreground">Buscar</button>
      </form>
      <p className="mt-2 text-sm text-muted-foreground">Também aceita o código de inscrição ou a leitura do QR Code.</p>
      {error && <p role="alert" className="mt-4 rounded-md border border-destructive bg-accent p-3 font-medium text-destructive">{error}</p>}
      {loading && <p className="mt-6 text-muted-foreground">Buscando...</p>}
      {hits && !loading && hits.length === 0 && (
        <p className="mt-6 rounded-md border bg-card p-6 text-center font-semibold">Participante não encontrado.</p>
      )}
      <div className="mt-6 space-y-4">
        {hits?.map((h) => {
          const done = h.registration_status === "checkin";
          const res = result?.id === h.id ? result.kind : null;
          return (
            <div key={h.id} className="overflow-hidden rounded-md border bg-card">
              <div className="p-5">
                <p className="font-display text-3xl font-bold uppercase leading-tight">{h.participants?.first_name} {h.participants?.last_name}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted-foreground">Status</dt><dd className="font-semibold">{STATUS_LABEL[h.registration_status]}</dd>
                  <dt className="text-muted-foreground">Alimento</dt><dd className="font-semibold">{h.food_item || "Não informado"}</dd>
                  <dt className="text-muted-foreground">CPF</dt><dd className="font-mono">{maskCpf(h.participants?.cpf ?? "")}</dd>
                  <dt className="text-muted-foreground">Código</dt><dd className="font-mono">{h.registration_code}</dd>
                </dl>
              </div>
              {res === "ok" ? (
                <div className="bg-success p-5 text-center font-display text-3xl font-extrabold uppercase text-success-foreground">Presença confirmada</div>
              ) : done || res === "already" ? (
                <div className="bg-secondary p-5 text-center font-display text-2xl font-bold uppercase text-secondary-foreground">Participante já registrado.</div>
              ) : h.registration_status === "cancelado" ? (
                <div className="bg-muted p-5 text-center font-display text-xl uppercase text-muted-foreground">Inscrição cancelada</div>
              ) : (
                <button onClick={() => confirm(h)} className="h-16 w-full bg-red-gradient font-display text-2xl font-extrabold uppercase tracking-wider text-primary-foreground">
                  Confirmar presença
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
