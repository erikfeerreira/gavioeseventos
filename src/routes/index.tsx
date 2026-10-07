import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { EventNotFound, EventPage } from "@/components/event/EventPage";
import { featuredEventQuery, publicEventQuery } from "@/lib/events";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    const slug = await context.queryClient.ensureQueryData(featuredEventQuery());
    if (slug) await context.queryClient.ensureQueryData(publicEventQuery(slug));
  },
  head: () => ({
    meta: [
      { title: "Eventos Academia Gaviões Poá" },
      { name: "description", content: "Eventos da Academia Gaviões Poá: informações e inscrições." },
      { property: "og:title", content: "Eventos Academia Gaviões Poá" },
      { property: "og:description", content: "Eventos da Academia Gaviões Poá: informações e inscrições." },
    ],
  }),
  component: Home,
  errorComponent: () => <EventNotFound />,
});

function Home() {
  const { data: slug } = useSuspenseQuery(featuredEventQuery());
  if (!slug) return <EventNotFound />;
  return <Featured slug={slug} />;
}

function Featured({ slug }: { slug: string }) {
  const { data } = useSuspenseQuery(publicEventQuery(slug));
  if (!data) return <EventNotFound />;
  return <EventPage event={data.event} partners={data.partners} />;
}
