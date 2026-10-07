import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle, RequireManager } from "@/components/admin/AdminShell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { asList, type Activity, type EventRow, type FaqItem } from "@/lib/events";
import { friendlyError } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/eventos/$id")({
  component: () => (
    <RequireManager>
      <EventSettings />
    </RequireManager>
  ),
});

const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens.");

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border bg-card p-5">
      <h2 className="mb-4 text-xl font-bold uppercase">{title}</h2>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}
function F({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block">{label}</Label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function EventSettings() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const ev = useQuery({
    queryKey: ["admin-event", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const partners = useQuery({
    queryKey: ["admin-partners"],
    queryFn: async () => (await supabase.from("partners").select("*").order("name")).data ?? [],
  });
  const linked = useQuery({
    queryKey: ["event-partners", id],
    queryFn: async () => (await supabase.from("event_partners").select("partner_id").eq("event_id", id)).data?.map((r) => r.partner_id) ?? [],
  });

  const [f, setF] = useState<EventRow | null>(null);
  const [rules, setRules] = useState("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [faq, setFaq] = useState<FaqItem[]>([]);
  const [sel, setSel] = useState<string[]>([]);

  useEffect(() => {
    if (ev.data) {
      setF(ev.data);
      setRules(asList<string>(ev.data.rules).join("\n"));
      setActivities(asList<Activity>(ev.data.activities));
      setFaq(asList<FaqItem>(ev.data.faq));
    }
  }, [ev.data]);
  useEffect(() => { if (linked.data) setSel(linked.data); }, [linked.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!f) return;
      const slug = slugSchema.safeParse(f.slug);
      if (!slug.success) throw new Error(slug.error.issues[0].message);
      if (!f.name.trim()) throw new Error("Informe o nome do evento.");
      const consentChanged = ev.data && ev.data.consent_text !== f.consent_text;
      const nextVersion = consentChanged ? `v${Number((f.consent_version || "v1").replace(/\D/g, "") || 1) + 1}` : f.consent_version;
      const { error } = await supabase.from("events").update({
        name: f.name.trim(), slug: f.slug, slogan: f.slogan || null, description: f.description || null,
        date: f.date || null, start_time: f.start_time || null, end_time: f.end_time || null, location: f.location || null,
        status: f.status, registration_open: f.registration_open,
        registration_limit: f.registration_limit ? Number(f.registration_limit) : null,
        logo_url: f.logo_url || null, cover_image_url: f.cover_image_url || null,
        how_to_participate: f.how_to_participate || null, food_rule_text: f.food_rule_text || null,
        rules: rules.split("\n").map((r) => r.trim()).filter(Boolean),
        activities: activities.filter((a) => a.title.trim()),
        faq: faq.filter((q) => q.question.trim() && q.answer.trim()),
        consent_text: f.consent_text || null, consent_version: nextVersion,
        confirmation_message: f.confirmation_message || null,
      }).eq("id", id);
      if (error) {
        if (error.message.includes("duplicate")) throw new Error("Este endereço (slug) já está em uso.");
        throw error;
      }
      const cur = linked.data ?? [];
      const add = sel.filter((p) => !cur.includes(p));
      const del = cur.filter((p) => !sel.includes(p));
      if (add.length) await supabase.from("event_partners").insert(add.map((partner_id) => ({ event_id: id, partner_id })));
      if (del.length) await supabase.from("event_partners").delete().eq("event_id", id).in("partner_id", del);
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Evento salvo.");
    },
    onError: (e) => toast.error(e instanceof Error && !/fetch/i.test(e.message) && e.message.length < 80 ? e.message : friendlyError(e)),
  });

  if (!f) return <p className="text-muted-foreground">{ev.isError ? "Evento não encontrado." : "Carregando..."}</p>;
  const set = <K extends keyof EventRow>(k: K, v: EventRow[K]) => setF((p) => (p ? { ...p, [k]: v } : p));
  const sm = "h-11";

  return (
    <div className="pb-24">
      <PageTitle title="Configurar evento">
        <Link to="/eventos/$slug" params={{ slug: f.slug }} target="_blank" className="text-sm text-primary underline">Ver página pública</Link>
      </PageTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Informações">
          <F label="Nome *"><Input className={sm} value={f.name} onChange={(e) => set("name", e.target.value)} /></F>
          <F label="Endereço da página (slug) *" hint={`Página: /eventos/${f.slug}`}><Input className={sm} value={f.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} /></F>
          <F label="Slogan"><Input className={sm} value={f.slogan ?? ""} onChange={(e) => set("slogan", e.target.value)} /></F>
          <F label="Descrição"><Textarea rows={4} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} /></F>
          <div className="grid grid-cols-3 gap-3">
            <F label="Data"><Input type="date" className={sm} value={f.date ?? ""} onChange={(e) => set("date", e.target.value)} /></F>
            <F label="Início"><Input type="time" className={sm} value={f.start_time?.slice(0, 5) ?? ""} onChange={(e) => set("start_time", e.target.value)} /></F>
            <F label="Término"><Input type="time" className={sm} value={f.end_time?.slice(0, 5) ?? ""} onChange={(e) => set("end_time", e.target.value)} /></F>
          </div>
          <F label="Local"><Input className={sm} value={f.location ?? ""} onChange={(e) => set("location", e.target.value)} /></F>
        </Card>

        <Card title="Inscrições">
          <F label="Situação do evento">
            <select className="h-11 w-full rounded-md border bg-card px-3" value={f.status} onChange={(e) => set("status", e.target.value)}>
              <option value="draft">Rascunho (não aparece ao público)</option>
              <option value="published">Publicado</option>
              <option value="closed">Encerrado</option>
            </select>
          </F>
          <label className="flex items-center justify-between rounded-md border p-3">
            <span className="font-semibold">Inscrições abertas</span>
            <Switch checked={f.registration_open} onCheckedChange={(v) => set("registration_open", v)} />
          </label>
          <F label="Limite de vagas" hint="Deixe vazio para não limitar.">
            <Input type="number" min={1} className={sm} value={f.registration_limit ?? ""} onChange={(e) => set("registration_limit", e.target.value ? Number(e.target.value) : null)} />
          </F>
          <F label="Regra do alimento"><Textarea rows={2} value={f.food_rule_text ?? ""} onChange={(e) => set("food_rule_text", e.target.value)} /></F>
          <F label="Texto de consentimento (LGPD)" hint={`Versão atual: ${f.consent_version}. Ao alterar o texto, uma nova versão é registrada.`}>
            <Textarea rows={3} value={f.consent_text ?? ""} onChange={(e) => set("consent_text", e.target.value)} />
          </F>
          <F label="Mensagem de confirmação"><Input className={sm} value={f.confirmation_message ?? ""} onChange={(e) => set("confirmation_message", e.target.value)} /></F>
        </Card>

        <Card title="Visual">
          <F label="Imagem de capa (endereço da imagem)" hint="Vazio usa a imagem padrão."><Input className={sm} value={f.cover_image_url ?? ""} onChange={(e) => set("cover_image_url", e.target.value)} /></F>
          <F label="Logo do evento (endereço da imagem)" hint="Vazio usa o logo oficial da Academia Gaviões."><Input className={sm} value={f.logo_url ?? ""} onChange={(e) => set("logo_url", e.target.value)} /></F>
        </Card>

        <Card title="Conteúdo da página">
          <F label="Como participar" hint="Um passo por linha. Vazio usa o passo a passo padrão."><Textarea rows={3} value={f.how_to_participate ?? ""} onChange={(e) => set("how_to_participate", e.target.value)} /></F>
          <F label="Regras" hint="Uma regra por linha. Só aparece se preenchido."><Textarea rows={4} value={rules} onChange={(e) => setRules(e.target.value)} /></F>
        </Card>

        <Card title="Atividades">
          {activities.map((a, i) => (
            <div key={i} className="grid gap-2 rounded-md border p-3">
              <Input placeholder="Título" value={a.title} onChange={(e) => setActivities(activities.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
              <Input placeholder="Descrição (opcional)" value={a.description ?? ""} onChange={(e) => setActivities(activities.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              <button type="button" className="text-left text-sm text-destructive" onClick={() => setActivities(activities.filter((_, j) => j !== i))}>Remover</button>
            </div>
          ))}
          <button type="button" className="h-10 rounded-md border border-dashed" onClick={() => setActivities([...activities, { title: "", description: "" }])}>+ Adicionar atividade</button>
        </Card>

        <Card title="Perguntas frequentes">
          {faq.map((q, i) => (
            <div key={i} className="grid gap-2 rounded-md border p-3">
              <Input placeholder="Pergunta" value={q.question} onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} />
              <Textarea placeholder="Resposta" rows={2} value={q.answer} onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))} />
              <button type="button" className="text-left text-sm text-destructive" onClick={() => setFaq(faq.filter((_, j) => j !== i))}>Remover</button>
            </div>
          ))}
          <button type="button" className="h-10 rounded-md border border-dashed" onClick={() => setFaq([...faq, { question: "", answer: "" }])}>+ Adicionar pergunta</button>
        </Card>

        <Card title="Parceiros do evento">
          {!partners.data?.length && <p className="text-sm text-muted-foreground">Nenhum parceiro cadastrado. <Link to="/admin/parceiros" className="text-primary underline">Cadastrar parceiros</Link></p>}
          {partners.data?.map((p) => (
            <label key={p.id} className="flex items-center gap-3">
              <input type="checkbox" className="h-5 w-5 accent-primary" checked={sel.includes(p.id)} onChange={(e) => setSel(e.target.checked ? [...sel, p.id] : sel.filter((x) => x !== p.id))} />
              <span>{p.name}{!p.active && " (inativo)"}</span>
            </label>
          ))}
        </Card>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl justify-end">
          <button onClick={() => save.mutate()} disabled={save.isPending} className="h-12 rounded-md bg-red-gradient px-8 font-display text-lg uppercase tracking-wide text-primary-foreground disabled:opacity-60">
            {save.isPending ? "Salvando..." : "Salvar evento"}
          </button>
        </div>
      </div>
    </div>
  );
}
