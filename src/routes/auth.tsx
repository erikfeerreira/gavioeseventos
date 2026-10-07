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
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ type: "error" | "ok"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!email.trim() || password.length < 6) {
      setMsg({ type: "error", text: "Informe e-mail e senha (mínimo 6 caracteres)." });
      return;
    }
    setLoading(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setLoading(false);
      if (error) return setMsg({ type: "error", text: "E-mail ou senha incorretos, ou e-mail ainda não confirmado." });
      navigate({ to: "/admin" });
    } else {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin + "/admin", data: { name: name.trim() } },
      });
      setLoading(false);
      if (error) return setMsg({ type: "error", text: "Não foi possível criar a conta. Verifique os dados." });
      setMsg({ type: "ok", text: "Conta criada! Confirme pelo link enviado ao seu e-mail. Um administrador precisa liberar seu acesso." });
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-5 text-ink-foreground">
      <div className="w-full max-w-sm">
        <Logo variant="negative" className="mx-auto h-16 w-auto" />
        <h1 className="mt-8 text-center text-4xl font-extrabold uppercase italic">
          {mode === "in" ? "Acesso da equipe" : "Criar acesso"}
        </h1>
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-md bg-card p-6 text-card-foreground">
          {mode === "up" && (
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input id="name" className="h-12" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" className="h-12" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pw">Senha</Label>
            <Input id="pw" type="password" className="h-12" autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {msg && <p className={msg.type === "error" ? "text-sm font-medium text-destructive" : "text-sm font-medium text-success"}>{msg.text}</p>}
          <button disabled={loading} className="h-12 w-full rounded-md bg-red-gradient font-display text-lg font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-60">
            {loading ? "Aguarde..." : mode === "in" ? "Entrar" : "Criar conta"}
          </button>
        </form>
        <button onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }} className="mt-4 w-full text-center text-sm text-ink-foreground/60 underline">
          {mode === "in" ? "Primeiro acesso? Criar conta" : "Já tenho conta"}
        </button>
      </div>
    </main>
  );
}
