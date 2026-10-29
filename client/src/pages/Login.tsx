import { useState, type FormEvent } from "react";
import { Loader2, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ElosLogo } from "@/components/ElosLogo";
import { useAuthContext } from "@/contexts/AuthContext";

type Mode = "signin" | "forgot" | "new-password";

export default function LoginPage({ initialMode = "signin" }: { initialMode?: Mode }) {
  const auth = useAuthContext();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!auth) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const message = await auth.signIn(email, password);
        if (message) setError(message);
      } else if (mode === "forgot") {
        const message = await auth.sendPasswordReset(email);
        if (message) setError(message);
        else
          setNotice(
            "Se esse e-mail tiver acesso ao Elos, enviamos um link para criar uma nova senha. Confira também o spam."
          );
      } else {
        if (password.length < 8) {
          setError("A senha precisa ter pelo menos 8 caracteres.");
        } else if (password !== confirm) {
          setError("As duas senhas não são iguais.");
        } else {
          const message = await auth.updatePassword(password);
          if (message) setError(message);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === "signin" ? "Entrar no Elos" : mode === "forgot" ? "Recuperar senha" : "Criar nova senha";
  const subtitle =
    mode === "signin"
      ? "Use o e-mail e a senha do seu acesso."
      : mode === "forgot"
        ? "Informe seu e-mail para receber o link de recuperação."
        : "Escolha a nova senha do seu acesso.";

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-8 shadow-lg backdrop-blur-xl">
        <div className="mb-8 flex justify-center">
          <ElosLogo tone="onLight" />
        </div>
        <h1 className="text-center text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">{subtitle}</p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={submit} noValidate>
          {mode !== "new-password" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-email">E-mail</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@venturiholding.com.br"
                />
              </div>
            </div>
          )}

          {mode !== "forgot" && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password">{mode === "new-password" ? "Nova senha" : "Senha"}</Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => {
                      setMode("forgot");
                      setError(null);
                    }}
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-password"
                  type="password"
                  autoComplete={mode === "new-password" ? "new-password" : "current-password"}
                  required
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          {mode === "new-password" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-confirm">Repita a nova senha</Label>
              <Input
                id="login-confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
              {notice}
            </p>
          )}

          <Button type="submit" disabled={busy} className="mt-1 w-full">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Entrar" : mode === "forgot" ? "Enviar link" : "Salvar nova senha"}
          </Button>

          {mode === "forgot" && (
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                setMode("signin");
                setError(null);
                setNotice(null);
              }}
            >
              Voltar para o login
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
