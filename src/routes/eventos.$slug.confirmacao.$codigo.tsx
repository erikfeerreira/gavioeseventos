import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RegistrationConfirmation } from "@/components/event/RegistrationConfirmation";
import { supabase } from "@/integrations/supabase/client";
import { publicEventQuery } from "@/lib/events";

export const Route = createFileRoute("/eventos/$slug/confirmacao/$codigo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Inscrição confirmada | Academia Gaviões Poá" },
      { name: "description", content: "Confirmação da sua inscrição em evento da Academia Gaviões Poá." },
      { property: "og:title", content: "Inscrição confirmada | Academia Gaviões Poá" },
      { property: "og:description", content: "Confirmação da sua inscrição em evento da Academia Gaviões Poá." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConfirmationRoute,
});

function ConfirmationRoute() {
  const { slug, codigo } = Route.useParams();
  const ev = useQuery(publicEventQuery(slug));
  const reg = useQuery({
    queryKey: ["confirmation", codigo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_registration_confirmation", { _code: codigo });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  if (ev.isLoading || reg.isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-ink font-display text-2xl uppercase text-ink-foreground">Carregando...</div>;
  }
  if (!ev.data || !reg.data || reg.data.event_slug !== slug) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink px-5 text-center text-ink-foreground">
        <h1 className="text-4xl font-extrabold uppercase italic">Inscrição não encontrada</h1>
        <Link to="/eventos/$slug" params={{ slug }} className="font-display uppercase text-primary underline">Voltar ao evento</Link>
      </div>
    );
  }
  return <RegistrationConfirmation event={ev.data.event} registration={reg.data} />;
}
