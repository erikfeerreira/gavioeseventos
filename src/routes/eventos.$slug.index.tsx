import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { EventNotFound, EventPage } from "@/components/event/EventPage";
import { publicEventQuery } from "@/lib/events";

export const Route = createFileRoute("/eventos/$slug/")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(publicEventQuery(params.slug));
    return { name: data?.event.name ?? null, slogan: data?.event.slogan ?? null };
  },
  head: ({ loaderData }) => {
    const title = loaderData?.name ? `${loaderData.name} | Academia Gaviões Poá` : "Evento | Academia Gaviões Poá";
    const desc = loaderData?.slogan || "Inscrições para eventos da Academia Gaviões Poá.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: EventRoute,
  errorComponent: () => <EventNotFound />,
  notFoundComponent: () => <EventNotFound />,
});

function EventRoute() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(publicEventQuery(slug));
  if (!data) return <EventNotFound />;
  return <EventPage event={data.event} partners={data.partners} />;
}
