import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle, RequireManager } from "@/components/admin/AdminShell";
import { useEventsList } from "@/components/admin/EventSelect";
import { Badge } from "@/components/ui/badge";
import { TO_DEFINE, formatDate, friendlyError } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/eventos/")({
  component: () => (
    <RequireManager>
      <EventsList />
    </RequireManager>
  ),
});

const STATUS: Record<string, string> = { draft: "Rascunho", published: "Publicado", closed: "Encerrado" };

function EventsList() {
  const { data, isLoading } = useEventsList();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const create = useMutation({
    mutationFn: async () => {
      const slug = `novo-evento-${Date.now().toString(36)}`;
      const { data, error } = await supabase
        .from("events")
        .insert({ name: "Novo evento", slug, status: "draft", consent_text: "Autorizo a Academia Gaviões Poá a utilizar os dados informados neste formulário exclusivamente para a organização e o controle de presença deste evento." })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["admin-events"] });
      navigate({ to: "/admin/eventos/$id", params: { id } });
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  return (
    <div>
      <PageTitle title="Eventos">
        <button onClick={() => create.mutate()} className="h-11 rounded-md bg-red-gradient px-5 font-display uppercase tracking-wide text-primary-foreground">
          + Novo evento
        </button>
      </PageTitle>
      {isLoading && <p className="text-muted-foreground">Carregando...</p>}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data?.map((e) => (
          <Link key={e.id} to="/admin/eventos/$id" params={{ id: e.id }} className="rounded-md border bg-card p-5 transition-colors hover:border-primary">
            <div className="flex items-center justify-between gap-2">
              <Badge variant={e.status === "published" ? "default" : "secondary"}>{STATUS[e.status]}</Badge>
              <span className="text-xs text-muted-foreground">{e.registration_open ? "Inscrições abertas" : "Inscrições fechadas"}</span>
            </div>
            <h2 className="mt-3 text-2xl font-bold uppercase">{e.name}</h2>
            <p className="text-sm text-muted-foreground">{formatDate(e.date) ?? TO_DEFINE} · /eventos/{e.slug}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
