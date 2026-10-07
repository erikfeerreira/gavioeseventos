import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "staff" | "checkin";

export function useRoles() {
  const q = useQuery({
    queryKey: ["my-roles"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { roles: [] as Role[], email: null as string | null };
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      return { roles: (data ?? []).map((r) => r.role as Role), email: u.user.email ?? null };
    },
  });
  const roles = q.data?.roles ?? [];
  return {
    ...q,
    roles,
    email: q.data?.email,
    isAdmin: roles.includes("admin"),
    isManager: roles.includes("admin") || roles.includes("staff"),
    isTeam: roles.length > 0,
  };
}
