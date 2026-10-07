import type { ReactNode } from "react";
import { asList, type Activity, type EventRow, type FaqItem, type Partner } from "@/lib/events";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export function Section({ id, eyebrow, title, children, tone = "light" }: {
  id?: string; eyebrow: string; title: string; children: ReactNode; tone?: "light" | "dark" | "sand";
}) {
  const toneCls = tone === "dark" ? "bg-ink text-ink-foreground" : tone === "sand" ? "sand-texture text-sand-foreground" : "bg-background";
  return (
    <section id={id} className={`${toneCls} px-5 py-16 md:py-24`}>
      <div className="mx-auto max-w-6xl">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2 text-4xl font-extrabold uppercase italic md:text-6xl">{title}</h2>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

export function EventInfo({ event }: { event: EventRow }) {
  if (!event.description) return null;
  return (
    <Section eyebrow="Sobre" title="O evento">
      <p className="max-w-3xl whitespace-pre-line text-lg leading-relaxed text-muted-foreground md:text-xl">{event.description}</p>
    </Section>
  );
}

export function HowToParticipate({ event }: { event: EventRow }) {
  const steps = event.how_to_participate
    ? event.how_to_participate.split("\n").filter(Boolean)
    : ["Faça sua inscrição no formulário abaixo.", "Guarde seu código de inscrição.", "Apresente o código ou seu CPF na entrada do evento."];
  return (
    <Section eyebrow="Passo a passo" title="Como participar" tone="dark">
      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={i} className="rounded-md border border-graphite bg-graphite/60 p-6">
            <span className="font-display text-5xl font-extrabold italic text-primary">{String(i + 1).padStart(2, "0")}</span>
            <p className="mt-3 text-lg">{s}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function FoodRule({ event }: { event: EventRow }) {
  if (!event.food_rule_text) return null;
  return (
    <section className="sand-texture px-5 py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:gap-10">
        <p className="font-display text-7xl font-extrabold italic leading-none text-primary-deep md:text-9xl">+1</p>
        <div>
          <p className="eyebrow">Regra do alimento</p>
          <p className="mt-2 font-display text-3xl font-bold uppercase leading-tight text-sand-foreground md:text-4xl">{event.food_rule_text}</p>
        </div>
      </div>
    </section>
  );
}

export function EventRules({ event }: { event: EventRow }) {
  const rules = asList<string>(event.rules).filter(Boolean);
  if (!rules.length) return null;
  return (
    <Section eyebrow="Importante" title="Regras">
      <ul className="grid gap-3 md:grid-cols-2">
        {rules.map((r, i) => (
          <li key={i} className="flex gap-3 rounded-md border bg-card p-4">
            <span className="mt-1 h-3 w-3 shrink-0 bg-primary" />
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function EventActivities({ event }: { event: EventRow }) {
  const items = asList<Activity>(event.activities).filter((a) => a?.title);
  if (!items.length) return null;
  return (
    <Section eyebrow="Programação" title="Atividades" tone="dark">
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((a, i) => (
          <div key={i} className="border-l-4 border-primary bg-graphite/60 p-6">
            <h3 className="text-2xl font-bold uppercase">{a.title}</h3>
            {a.description && <p className="mt-2 text-ink-foreground/75">{a.description}</p>}
          </div>
        ))}
      </div>
    </Section>
  );
}

export function PartnerSection({ partners }: { partners: Partner[] }) {
  if (!partners.length) return null;
  return (
    <Section eyebrow="Quem está junto" title="Parceiros">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {partners.map((p) => (
          <div key={p.id} className="flex flex-col items-center justify-center gap-3 rounded-md border bg-card p-6 text-center">
            {p.logo_url ? <img src={p.logo_url} alt={p.name} loading="lazy" className="h-16 w-auto object-contain" /> : null}
            <p className="font-display text-lg font-bold uppercase">{p.name}</p>
            {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
          </div>
        ))}
      </div>
    </Section>
  );
}

export function EventFaq({ event }: { event: EventRow }) {
  const items = asList<FaqItem>(event.faq).filter((f) => f?.question && f?.answer);
  if (!items.length) return null;
  return (
    <Section eyebrow="Dúvidas" title="Perguntas frequentes">
      <Accordion type="single" collapsible className="max-w-3xl">
        {items.map((f, i) => (
          <AccordionItem key={i} value={`f${i}`}>
            <AccordionTrigger className="text-left text-lg font-semibold">{f.question}</AccordionTrigger>
            <AccordionContent className="text-base text-muted-foreground">{f.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Section>
  );
}
