import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { acceptInviteToken, checkInviteToken } from "@/lib/team.functions";

export const Route = createFileRoute("/convite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Convite da equipe | Academia Gaviões Poá" },
      { name: "description", content: "Ative seu acesso à equipe da Academia Gaviões Poá." },
      { property: "og:title", content: "Convite da equipe | Academia Gaviões Poá" },
      { property: "og:description", content: "Ative seu acesso à equipe da Academia Gaviões Poá." },
      { name: "robots", content: "noindex" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: AcceptInvite,
});

function AcceptInvite() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const check = useServerFn(checkInviteToken);
  const accept = useServerFn(acceptInviteToken);
  const [info, setInfo] = useState<{ valid: boolean; email?: string; name?: string } | null>(null);
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    check({ data: { token } })
      .then((r) => { setInfo(r); if (r.valid) setName(r.name ?? ""); })
      .catch(() => setInfo({ valid: false }));
  }, [token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!name.trim()) return setMsg("Informe seu nome.");
    if (pw.length < 8) return setMsg("A senha precisa ter pelo menos 8 caracteres.");
    if (pw !== pw2) return setMsg("As senhas não conferem.");
    setLoading(true);
    try {
      const r = await accept({ data: { token, password: pw, name } });
      await supabase.auth.signOut();
      const { error } = await supabase.auth.signInWithPassword({ email: r.email, password: pw });
      if (error) { setLoading(false); return navigate({ to: "/auth" }); }
      navigate({ to: "/admin", replace: true });
    } catch (err) {
      setLoading(false);
      const m = (err as Error)?.message ?? "";
      setMsg(
        m.includes("INVITE_INVALID") ? "Este link expirou ou já foi usado. Peça um novo ao administrador."
        : m.includes("USER_EXISTS") ? "Este e-mail já tem conta ativa. Entre pela página de acesso da equipe."
        : "Não foi possível ativar agora. Tente novamente.",
      );
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-5 text-ink-foreground">
      <div className="w-full max-w-sm">
        <Logo variant="negative" className="mx-auto h-16 w-auto" />
        <h1 className="mt-8 text-center text-4xl font-extrabold uppercase italic">Ativar acesso</h1>
        {info === null ? (
          <p className="mt-6 text-center text-ink-foreground/70">Verificando convite...</p>
        ) : !info.valid ? (
          <p className="mt-6 rounded-md bg-card p-6 text-center text-card-foreground">Este link expirou ou já foi usado. Peça um novo ao administrador.</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4 rounded-md bg-card p-6 text-card-foreground">
            <p className="text-sm text-muted-foreground">Convite para <strong className="text-foreground">{info.email}</strong></p>
            <div>
              <Label htmlFor="name">Seu nome</Label>
              <Input id="name" className="h-12" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pw">Crie uma senha</Label>
              <Input id="pw" type="password" className="h-12" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pw2">Repita a senha</Label>
              <Input id="pw2" type="password" className="h-12" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
            {msg && <p className="text-sm font-medium text-destructive">{msg}</p>}
            <button disabled={loading} className="h-12 w-full rounded-md bg-red-gradient font-display text-lg font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-60">
              {loading ? "Ativando..." : "Ativar e entrar"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
