import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle, RequireManager } from "@/components/admin/AdminShell";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { friendlyError } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/parceiros")({
  component: () => (
    <RequireManager>
      <Partners />
    </RequireManager>
  ),
});

function Partners() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", logo_url: "", description: "" });
  const list = useQuery({
    queryKey: ["admin-partners"],
    queryFn: async () => (await supabase.from("partners").select("*").order("name")).data ?? [],
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-partners"] });
  const add = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe o nome.");
      const { error } = await supabase.from("partners").insert({
        name: form.name.trim().slice(0, 120),
        logo_url: form.logo_url.trim() || null,
        description: form.description.trim().slice(0, 300) || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setForm({ name: "", logo_url: "", description: "" }); refresh(); toast.success("Parceiro cadastrado."); },
    onError: (e) => toast.error(e instanceof Error && e.message === "Informe o nome." ? e.message : friendlyError(e)),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("partners").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e) => toast.error(friendlyError(e)),
  });

  return (
    <div>
      <PageTitle title="Parceiros" />
      <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="mb-6 grid gap-3 rounded-md border bg-card p-5 md:grid-cols-4">
        <Input placeholder="Nome *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input placeholder="Endereço do logo (opcional)" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
        <Input placeholder="Descrição (opcional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button className="h-10 rounded-md bg-red-gradient font-display uppercase text-primary-foreground">Adicionar</button>
      </form>
      {!list.data?.length && <p className="text-muted-foreground">Nenhum parceiro cadastrado.</p>}
      <div className="grid gap-3 md:grid-cols-3">
        {list.data?.map((p) => (
          <div key={p.id} className="flex items-center gap-4 rounded-md border bg-card p-4">
            {p.logo_url && <img src={p.logo_url} alt="" className="h-12 w-12 object-contain" />}
            <div className="flex-1">
              <p className="font-bold">{p.name}</p>
              {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
            </div>
            <Switch checked={p.active} onCheckedChange={(v) => toggle.mutate({ id: p.id, active: v })} aria-label="Ativo" />
          </div>
        ))}
      </div>
    </div>
  );
}
