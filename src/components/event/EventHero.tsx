import heroDefault from "@/assets/hero-areia.jpg";
import { Logo } from "@/components/brand/Logo";
import { formatDateLong, formatTime } from "@/lib/format";
import type { EventRow } from "@/lib/events";

export function EventHero({ event, canRegister }: { event: EventRow; canRegister: boolean }) {
  const date = formatDateLong(event.date);
  const time = formatTime(event.start_time);
  return (
    <header className="relative isolate min-h-[92svh] overflow-hidden bg-ink text-ink-foreground">
      <img
        src={event.cover_image_url || heroDefault}
        alt=""
        width={1920}
        height={1088}
        className="absolute inset-0 -z-20 h-full w-full object-cover object-[60%_center]"
      />
      <div className="absolute inset-0 -z-10 bg-hero-overlay" />
      <div className="mx-auto flex min-h-[92svh] max-w-6xl flex-col px-5 pb-12 pt-6">
        <div className="flex items-center justify-between">
          {event.logo_url ? (
            <img src={event.logo_url} alt="" className="h-12 w-auto" />
          ) : (
            <Logo variant="negative" className="h-12 w-auto md:h-14" />
          )}
        </div>
        <div className="mt-auto max-w-3xl">
          <p className="eyebrow">Academia Gaviões Poá apresenta</p>
          <h1 className="mt-3 text-6xl font-extrabold uppercase italic leading-[0.85] sm:text-8xl md:text-[9rem]">
            {event.name}
          </h1>
          {event.slogan && (
            <p className="mt-4 font-display text-2xl font-medium uppercase tracking-wide text-sand sm:text-3xl">
              {event.slogan}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3 font-display text-lg uppercase">
            {date && <span className="border-l-4 border-primary pl-3">{date}</span>}
            {time && <span className="border-l-4 border-primary pl-3">{time}</span>}
            {event.location && <span className="border-l-4 border-primary pl-3">{event.location}</span>}
          </div>
          {canRegister && (
            <a
              href="#inscricao"
              className="mt-8 inline-flex h-14 w-full items-center justify-center rounded-md bg-red-gradient px-8 font-display text-xl font-bold uppercase tracking-wider text-primary-foreground shadow-red transition-transform hover:-translate-y-0.5 sm:w-auto"
            >
              Quero me inscrever
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
