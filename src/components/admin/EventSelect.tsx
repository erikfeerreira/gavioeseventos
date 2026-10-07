import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useEventsList = () =>
  useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("date", { ascending: false, nullsFirst: true });
      if (error) throw error;
      return data;
    },
  });

export function EventSelect({ value, onChange, allowAll }: { value: string; onChange: (v: string) => void; allowAll?: boolean }) {
  const { data } = useEventsList();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 rounded-md border bg-card px-3 text-sm">
      {allowAll && <option value="">Todos os eventos</option>}
      {(data ?? []).map((e) => (
        <option key={e.id} value={e.id}>{e.name}</option>
      ))}
    </select>
  );
}
