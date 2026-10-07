import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type EventRow = Tables<"events">;
export type Partner = Tables<"partners">;
export type Activity = { title: string; description?: string };
export type FaqItem = { question: string; answer: string };

export const asList = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export const featuredEventQuery = () =>
  queryOptions({
    queryKey: ["public-event", "featured"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("slug")
        .eq("status", "published")
        .order("date", { ascending: true, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.slug ?? null;
    },
  });

export const publicEventQuery = (slug: string) =>
  queryOptions({
    queryKey: ["public-event", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("slug", slug).neq("status", "draft").maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: links } = await supabase
        .from("event_partners")
        .select("partners(*)")
        .eq("event_id", data.id);
      const partners = (links ?? [])
        .map((l) => (l as unknown as { partners: Partner | null }).partners)
        .filter((p): p is Partner => !!p && p.active);
      return { event: data, partners };
    },
  });

export function calendarUrl(ev: EventRow) {
  if (!ev.date || !ev.start_time) return null;
  const d = ev.date.replace(/-/g, "");
  const s = ev.start_time.replace(/:/g, "").slice(0, 6);
  const e = (ev.end_time || ev.start_time).replace(/:/g, "").slice(0, 6);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.name,
    dates: `${d}T${s}/${d}T${e}`,
    details: ev.description || "",
    location: ev.location || "",
    ctz: "America/Sao_Paulo",
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
