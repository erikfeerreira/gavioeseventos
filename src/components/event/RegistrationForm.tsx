import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCpf, formatPhone, friendlyError, isValidCpf, onlyDigits } from "@/lib/format";
import type { EventRow } from "@/lib/events";

const today = () => new Date().toISOString().slice(0, 10);

const schema = z.object({
  firstName: z.string().trim().min(1, "Informe seu nome.").max(80),
  lastName: z.string().trim().min(1, "Informe seu sobrenome.").max(120),
  cpf: z.string().refine(isValidCpf, "CPF inválido. Confira os números digitados."),
  birthDate: z
    .string()
    .min(1, "Informe sua data de nascimento.")
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= "1900-01-01" && v <= today(), "Data de nascimento inválida."),
  whatsapp: z.string().refine((v) => !v || [10, 11].includes(onlyDigits(v).length), "WhatsApp inválido. Use DDD + número."),
  food: z.string().trim().max(200),
  consent: z.boolean().refine((v) => v, "É preciso aceitar para continuar."),
});

type Form = { firstName: string; lastName: string; cpf: string; birthDate: string; whatsapp: string; food: string; consent: boolean };

export function RegistrationForm({ event, blockedReason }: { event: EventRow; blockedReason: string | null }) {
  const navigate = useNavigate();
  const [f, setF] = useState<Form>({ firstName: "", lastName: "", cpf: "", birthDate: "", whatsapp: "", food: "", consent: false });
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = schema.safeParse(f);
    if (!parsed.success) {
      const errs: Partial<Record<keyof Form, string>> = {};
      for (const i of parsed.error.issues) errs[i.path[0] as keyof Form] ??= i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    const { data, error } = await supabase.rpc("register_for_event", {
      _event_id: event.id,
      _first_name: f.firstName.trim(),
      _last_name: f.lastName.trim(),
      _cpf: onlyDigits(f.cpf),
      _birth_date: f.birthDate,
      _whatsapp: onlyDigits(f.whatsapp),
      _food_item: f.food.trim(),
      _consent: f.consent,
    });
    setLoading(false);
    if (error || !data) {
      setFormError(friendlyError(error));
      return;
    }
    navigate({ to: "/eventos/$slug/confirmacao/$codigo", params: { slug: event.slug, codigo: data } });
  }

  if (blockedReason) {
    return (
      <div className="rounded-md border-2 border-primary bg-accent p-8 text-center">
        <p className="font-display text-3xl font-bold uppercase text-accent-foreground">{blockedReason}</p>
      </div>
    );
  }

  const field = (k: keyof Form) => (errors[k] ? <p className="mt-1 text-sm font-medium text-destructive">{errors[k]}</p> : null);
  const inputCls = "h-13 text-base";

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 rounded-md border bg-card p-5 shadow-sm md:grid-cols-2 md:p-8">
      {event.food_rule_text && (
        <div className="rounded-md bg-red-gradient p-4 font-semibold text-primary-foreground md:col-span-2">{event.food_rule_text}</div>
      )}
      <div>
        <Label htmlFor="fn">Nome *</Label>
        <Input id="fn" className={inputCls} autoComplete="given-name" value={f.firstName} onChange={(e) => set("firstName", e.target.value)} />
        {field("firstName")}
      </div>
      <div>
        <Label htmlFor="ln">Sobrenome *</Label>
        <Input id="ln" className={inputCls} autoComplete="family-name" value={f.lastName} onChange={(e) => set("lastName", e.target.value)} />
        {field("lastName")}
      </div>
      <div>
        <Label htmlFor="cpf">CPF *</Label>
        <Input id="cpf" className={inputCls} inputMode="numeric" placeholder="000.000.000-00" value={f.cpf} onChange={(e) => set("cpf", formatCpf(e.target.value))} />
        {field("cpf")}
      </div>
      <div>
        <Label htmlFor="bd">Data de nascimento *</Label>
        <Input id="bd" type="date" className={inputCls} max={today()} value={f.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
        {field("birthDate")}
      </div>
      <div>
        <Label htmlFor="wa">WhatsApp</Label>
        <Input id="wa" className={inputCls} inputMode="tel" autoComplete="tel" placeholder="(11) 90000-0000" value={f.whatsapp} onChange={(e) => set("whatsapp", formatPhone(e.target.value))} />
        {field("whatsapp")}
      </div>
      <div>
        <Label htmlFor="food">O que vai trazer no dia?</Label>
        <Input id="food" className={inputCls} placeholder="Ex.: arroz, feijão, macarrão..." value={f.food} onChange={(e) => set("food", e.target.value)} />
        {field("food")}
      </div>
      <div className="md:col-span-2">
        <label className="flex items-start gap-3 text-sm leading-relaxed">
          <Checkbox className="mt-0.5 h-5 w-5" checked={f.consent} onCheckedChange={(v) => set("consent", v === true)} />
          <span>{event.consent_text || "Autorizo o uso dos meus dados para a organização deste evento."}</span>
        </label>
        {field("consent")}
      </div>
      {formError && (
        <p role="alert" className="rounded-md border border-destructive bg-accent p-3 font-medium text-destructive md:col-span-2">{formError}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="h-14 rounded-md bg-red-gradient font-display text-xl font-bold uppercase tracking-wider text-primary-foreground shadow-red disabled:opacity-60 md:col-span-2"
      >
        {loading ? "Enviando..." : "Confirmar inscrição"}
      </button>
    </form>
  );
}
