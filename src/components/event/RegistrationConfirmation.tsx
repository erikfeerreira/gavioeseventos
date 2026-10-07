import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { asList, calendarUrl, type EventRow } from "@/lib/events";
import { TO_DEFINE, formatDateLong, formatTime } from "@/lib/format";

type Reg = { first_name: string; last_name: string; food_item: string | null; registration_code: string };

export function RegistrationConfirmation({ event, registration }: { event: EventRow; registration: Reg }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    // qrcode only loads in the browser, never during SSR/production build
    if (import.meta.env.SSR) return;
    let cancelled = false;
    // browser entry point: no Node APIs, safe for the server bundle
    import("qrcode/lib/browser").then(({ default: QRCode }) => {
      const url = `${window.location.origin}/checkin?codigo=${registration.registration_code}`;
      QRCode.toDataURL(url, { margin: 1, width: 360 })
        .then((data) => { if (!cancelled) setQr(data); })
        .catch(() => { if (!cancelled) setQr(null); });
    }).catch(() => { if (!cancelled) setQr(null); });
    return () => { cancelled = true; };
  }, [registration.registration_code]);

  const cal = calendarUrl(event);
  const rules = asList<string>(event.rules).filter(Boolean);
  const time = formatTime(event.start_time);
  const rows: [string, string][] = [
    ["Participante", `${registration.first_name} ${registration.last_name}`],
    ["Evento", event.name],
    ["Data", formatDateLong(event.date) ?? TO_DEFINE],
    ["Horário", time ? `${time}${event.end_time ? ` às ${formatTime(event.end_time)}` : ""}` : TO_DEFINE],
    ["Local", event.location || TO_DEFINE],
    ["Alimento informado", registration.food_item || "Não informado"],
  ];

  return (
    <main className="min-h-screen bg-ink px-5 py-10 text-ink-foreground">
      <div className="mx-auto max-w-xl">
        <Logo variant="negative" className="h-12 w-auto" />
        <p className="eyebrow mt-10">Tudo certo</p>
        <h1 className="mt-2 text-5xl font-extrabold uppercase italic leading-none">
          {event.confirmation_message || "Inscrição realizada com sucesso!"}
        </h1>

        <div className="mt-8 overflow-hidden rounded-md bg-card text-card-foreground">
          <div className="flex flex-col items-center gap-3 bg-red-gradient p-6 text-primary-foreground">
            <p className="font-display text-sm uppercase tracking-[0.3em]">Código de inscrição</p>
            <p className="font-display text-5xl font-extrabold tracking-[0.15em]">{registration.registration_code}</p>
            {qr && <img src={qr} alt="QR Code da inscrição" className="h-44 w-44 rounded bg-card p-2" />}
            <p className="text-center text-sm opacity-90">Apresente este código ou seu CPF na entrada.</p>
          </div>
          <dl className="divide-y">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-5 py-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {(event.food_rule_text || rules.length > 0) && (
          <div className="mt-6 rounded-md border border-graphite p-5">
            <p className="eyebrow">Regras importantes</p>
            <ul className="mt-3 space-y-2">
              {event.food_rule_text && <li>• {event.food_rule_text}</li>}
              {rules.map((r, i) => <li key={i}>• {r}</li>)}
            </ul>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {cal && (
            <a href={cal} target="_blank" rel="noreferrer" className="flex h-14 items-center justify-center rounded-md bg-primary font-display text-lg font-bold uppercase tracking-wider text-primary-foreground">
              Adicionar ao calendário
            </a>
          )}
          <button onClick={() => window.print()} className="h-12 rounded-md border border-graphite font-display uppercase tracking-wider">
            Salvar / imprimir comprovante
          </button>
          <Link to="/eventos/$slug" params={{ slug: event.slug }} className="text-center text-sm text-ink-foreground/60 underline">
            Voltar ao evento
          </Link>
        </div>
      </div>
    </main>
  );
}
