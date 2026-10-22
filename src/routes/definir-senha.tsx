import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/definir-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Definir senha | Academia Gaviões Poá" },
      { name: "description", content: "Defina a senha de acesso da equipe da Academia Gaviões Poá." },
      { property: "og:title", content: "Definir senha | Academia Gaviões Poá" },
      { property: "og:description", content: "Defina a senha de acesso da equipe da Academia Gaviões Poá." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SetPassword,
});

function SetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Invite and recovery links create a temporary session from the URL
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION")) setReady(true);
    });
    const t = setTimeout(async () => {
      const { data: s } = await supabase.auth.getSession();
      setReady(!!s.session);
    }, 1500);
    return () => { data.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 8) return setMsg("A senha precisa ter pelo menos 8 caracteres.");
    if (pw !== pw2) return setMsg("As senhas não conferem.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) {
      return setMsg(/pwned|leak|weak/i.test(error.message) ? "Essa senha é fraca ou já apareceu em vazamentos. Escolha outra." : "Não foi possível salvar a senha. O link pode ter expirado.");
    }
    navigate({ to: "/admin", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-5 text-ink-foreground">
      <div className="w-full max-w-sm">
        <Logo variant="negative" className="mx-auto h-16 w-auto" />
        <h1 className="mt-8 text-center text-4xl font-extrabold uppercase italic">Definir senha</h1>
        {ready === false ? (
          <p className="mt-6 rounded-md bg-card p-6 text-center text-card-foreground">Link inválido ou expirado. Peça um novo convite ao administrador ou use "Esqueci minha senha".</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4 rounded-md bg-card p-6 text-card-foreground">
            <div>
              <Label htmlFor="pw">Nova senha</Label>
              <Input id="pw" type="password" className="h-12" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pw2">Repita a senha</Label>
              <Input id="pw2" type="password" className="h-12" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
            {msg && <p className="text-sm font-medium text-destructive">{msg}</p>}
            <button disabled={loading || !ready} className="h-12 w-full rounded-md bg-red-gradient font-display text-lg font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-60">
              {loading ? "Salvando..." : "Salvar e entrar"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
