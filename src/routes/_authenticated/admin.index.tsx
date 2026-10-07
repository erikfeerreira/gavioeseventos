import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle } from "@/components/admin/AdminShell";
import { EventSelect, useEventsList } from "@/components/admin/EventSelect";
import { useRoles } from "@/lib/use-roles";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const { isManager, isLoading } = useRoles();
  const navigate = useNavigate();
  const events = useEventsList();
  const [eventId, setEventId] = useState("");

  useEffect(() => {
    if (!isLoading && !isManager) navigate({ to: "/checkin" });
  }, [isLoading, isManager, navigate]);
  useEffect(() => {
    if (!eventId && events.data?.length) setEventId(events.data[0].id);
  }, [events.data, eventId]);

  const regs = useQuery({
    queryKey: ["dashboard", eventId],
    enabled: !!eventId && isManager,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("registration_status, registered_at")
        .eq("event_id", eventId)
        .limit(10000);
      if (error) throw error;
      return data;
    },
  });

  const ev = events.data?.find((e) => e.id === eventId);
  const m = useMemo(() => {
    const list = regs.data ?? [];
    const active = list.filter((r) => r.registration_status !== "cancelado");
    const checkins = list.filter((r) => r.registration_status === "checkin").length;
    const absent = list.filter((r) => r.registration_status === "ausente").length;
    const byDay = new Map<string, number>();
    for (const r of list) {
      const d = r.registered_at.slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    }
    const timeline = [...byDay.entries()].sort().map(([d, n]) => ({ dia: `${d.slice(8, 10)}/${d.slice(5, 7)}`, inscricoes: n }));
    return {
      total: active.length,
      checkins,
      absent,
      pending: active.length - checkins - absent,
      rate: active.length ? Math.round((checkins / active.length) * 100) : 0,
      timeline,
    };
  }, [regs.data]);

  const vagas = ev?.registration_limit != null ? Math.max(ev.registration_limit - m.total, 0).toString() : "Sem limite";
  const cards = [
    ["Total de inscritos", m.total],
    ["Vagas disponíveis", vagas],
    ["Check-ins", m.checkins],
    ["Ausentes", m.absent],
    ["Taxa de presença", `${m.rate}%`],
  ];
  const pie = [
    { name: "Presentes", value: m.checkins, color: "var(--chart-1)" },
    { name: "Ausentes", value: m.absent, color: "var(--chart-2)" },
    { name: "Aguardando", value: m.pending, color: "var(--chart-3)" },
  ].filter((p) => p.value > 0);

  if (!isManager) return null;
  return (
    <div>
      <PageTitle title="Painel">
        <EventSelect value={eventId} onChange={setEventId} />
      </PageTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map(([k, v], i) => (
          <div key={k} className={i === 0 ? "rounded-md bg-red-gradient p-5 text-primary-foreground" : "rounded-md border bg-card p-5"}>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{k}</p>
            <p className="mt-2 font-display text-4xl font-extrabold">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-md border bg-card p-5 lg:col-span-2">
          <h2 className="text-xl font-bold uppercase">Inscrições ao longo do tempo</h2>
          <div className="mt-4 h-64">
            {m.timeline.length ? (
              <ResponsiveContainer>
                <BarChart data={m.timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="dia" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="inscricoes" name="Inscrições" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground">Ainda sem inscrições.</p>
            )}
          </div>
        </div>
        <div className="rounded-md border bg-card p-5">
          <h2 className="text-xl font-bold uppercase">Presença x ausência</h2>
          <div className="mt-4 h-64">
            {pie.length ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                    {pie.map((p) => <Cell key={p.name} fill={p.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground">Sem dados ainda.</p>
            )}
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {pie.map((p) => (
              <li key={p.name} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm" style={{ background: p.color }} /> {p.name}: {p.value}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
