import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { useRoles } from "@/lib/use-roles";

type AdminTo = "/admin" | "/admin/participantes" | "/checkin" | "/admin/eventos" | "/admin/parceiros" | "/admin/usuarios" | "/admin/historico";

export function AdminShell({ children }: { children: ReactNode }) {
  const { isAdmin, isManager, isTeam, isLoading, email } = useRoles();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const links = [
    isManager && { to: "/admin" as AdminTo, label: "Painel" },
    isManager && { to: "/admin/participantes" as AdminTo, label: "Participantes" },
    isTeam && { to: "/checkin" as AdminTo, label: "Check-in" },
    isManager && { to: "/admin/eventos" as AdminTo, label: "Eventos" },
    isManager && { to: "/admin/parceiros" as AdminTo, label: "Parceiros" },
    isAdmin && { to: "/admin/usuarios" as AdminTo, label: "Equipe" },
    isAdmin && { to: "/admin/historico" as AdminTo, label: "Histórico" },
  ].filter((l): l is { to: AdminTo; label: string } => !!l);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link to="/"><Logo variant="negative" className="h-9 w-auto" /></Link>
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                activeOptions={{ exact: l.to === "/admin" }}
                className="whitespace-nowrap rounded px-3 py-2 font-display text-sm font-semibold uppercase tracking-wide text-ink-foreground/70 hover:text-ink-foreground"
                activeProps={{ className: "bg-primary !text-primary-foreground" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <span className="hidden text-xs text-ink-foreground/50 md:block">{email}</span>
          <button onClick={signOut} className="rounded border border-graphite px-3 py-1.5 text-sm">Sair</button>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6">
        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : !isTeam ? (
          <div className="rounded-md border bg-card p-8 text-center">
            <h1 className="text-3xl font-bold uppercase">Acesso pendente</h1>
            <p className="mt-2 text-muted-foreground">Sua conta ainda não tem permissão. Peça a um administrador para liberar seu acesso.</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export function RequireManager({ children }: { children: ReactNode }) {
  const { isManager, isLoading } = useRoles();
  if (isLoading) return null;
  if (!isManager)
    return <p className="rounded-md border bg-card p-6 text-muted-foreground">Você não tem permissão para acessar esta área.</p>;
  return <>{children}</>;
}

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-4xl font-extrabold uppercase italic">{title}</h1>
      {children}
    </div>
  );
}
