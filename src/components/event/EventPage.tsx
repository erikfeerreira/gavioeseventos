import { Link } from "@tanstack/react-router";
import type { EventRow, Partner } from "@/lib/events";
import { EventHero } from "./EventHero";
import { EventActivities, EventFaq, EventInfo, EventRules, FoodRule, HowToParticipate, PartnerSection, Section } from "./EventSections";
import { RegistrationForm } from "./RegistrationForm";
import { SiteFooter } from "./SiteFooter";

export function registrationBlock(event: EventRow): string | null {
  const today = new Date().toISOString().slice(0, 10);
  if (event.status === "closed" || (event.date && event.date < today)) return "Evento encerrado";
  if (!event.registration_open) return "Inscrições fechadas no momento";
  return null;
}

export function EventPage({ event, partners }: { event: EventRow; partners: Partner[] }) {
  const blocked = registrationBlock(event);
  return (
    <main>
      <EventHero event={event} canRegister={!blocked} />
      <EventInfo event={event} />
      <HowToParticipate event={event} />
      <FoodRule event={event} />
      <EventRules event={event} />
      <EventActivities event={event} />
      <PartnerSection partners={partners} />
      <EventFaq event={event} />
      <Section id="inscricao" eyebrow="Garanta sua vaga" title="Inscrição">
        <RegistrationForm event={event} blockedReason={blocked} />
      </Section>
      <SiteFooter />
    </main>
  );
}

export function EventNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink px-5 text-center text-ink-foreground">
      <h1 className="text-5xl font-extrabold uppercase italic">Evento não encontrado</h1>
      <p className="text-ink-foreground/70">Nenhum evento disponível neste endereço.</p>
      <Link to="/" className="font-display text-lg uppercase text-primary underline">Voltar ao início</Link>
    </div>
  );
}
