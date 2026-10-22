import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Acesso da equipe | Academia Gaviões Poá" },
      { name: "description", content: "Área restrita para a equipe da Academia Gaviões Poá." },
      { property: "og:title", content: "Acesso da equipe | Academia Gaviões Poá" },
      { property: "og:description", content: "Área restrita para a equipe da Academia Gaviões Poá." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ type: "error" | "ok"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!email.trim()) return setMsg({ type: "error", text: "Informe o e-mail." });
    setLoading(true);
    if (mode === "in") {
      if (!password) { setLoading(false); return setMsg({ type: "error", text: "Informe a senha." }); }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setLoading(false);
      if (error) return setMsg({ type: "error", text: /rate|many/i.test(error.message) ? "Muitas tentativas. Aguarde alguns minutos." : "E-mail ou senha incorretos." });
      navigate({ to: "/admin" });
    } else {
      await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + "/definir-senha" });
      setLoading(false);
      // Same message whether or not the account exists (no account enumeration)
      setMsg({ type: "ok", text: "Se este e-mail tiver acesso, você receberá um link para criar uma nova senha." });
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-5 text-ink-foreground">
      <div className="w-full max-w-sm">
        <Logo variant="negative" className="mx-auto h-16 w-auto" />
        <h1 className="mt-8 text-center text-4xl font-extrabold uppercase italic">
          {mode === "in" ? "Acesso da equipe" : "Recuperar senha"}
        </h1>
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-md bg-card p-6 text-card-foreground">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" className="h-12" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode === "in" && (
            <div>
              <Label htmlFor="pw">Senha</Label>
              <Input id="pw" type="password" className="h-12" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}
          {msg && <p className={msg.type === "error" ? "text-sm font-medium text-destructive" : "text-sm font-medium text-success"}>{msg.text}</p>}
          <button disabled={loading} className="h-12 w-full rounded-md bg-red-gradient font-display text-lg font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-60">
            {loading ? "Aguarde..." : mode === "in" ? "Entrar" : "Enviar link"}
          </button>
        </form>
        <button onClick={() => { setMode(mode === "in" ? "forgot" : "in"); setMsg(null); }} className="mt-4 w-full text-center text-sm text-ink-foreground/60 underline">
          {mode === "in" ? "Esqueci minha senha" : "Voltar para o login"}
        </button>
        <p className="mt-6 text-center text-xs text-ink-foreground/50">Novos membros entram somente por convite de um administrador.</p>
      </div>
    </main>
  );
}
