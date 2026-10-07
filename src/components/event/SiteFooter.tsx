import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";

export function SiteFooter() {
  return (
    <footer className="bg-ink px-5 py-12 text-ink-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <Logo variant="negative" className="h-14 w-auto" />
        <div className="text-sm text-ink-foreground/60">
          <p>Academia Gaviões Poá</p>
          <p>© {new Date().getFullYear()} · Todos os direitos reservados</p>
        </div>
        <Link to="/auth" className="text-sm text-ink-foreground/50 hover:text-primary">Acesso da equipe</Link>
      </div>
    </footer>
  );
}
