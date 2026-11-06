import type { ReactNode } from "react";
import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/contexts/AuthContext";
import LoginPage from "@/pages/Login";
import { ambiente, bancoConfigurado } from "@/lib/supabase";

function FullScreenMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      {children}
    </div>
  );
}

/**
 * Só renderiza o sistema depois do login e da carga dos dados do banco.
 * Os providers de dados ficam dentro dele porque leem o armazenamento ao montar.
 */
/** Faixa discreta nos ambientes de teste: ninguém confunde com o Ellos oficial */
function FaixaAmbienteTeste() {
  if (ambiente !== "teste") return null;
  return (
    <div
      className="pointer-events-none fixed bottom-2 left-1/2 z-[100] -translate-x-1/2 rounded-md border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground"
      data-testid="faixa-ambiente-teste"
    >
      Ambiente de teste · dados inventados
    </div>
  );
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuthContext();
  const conteudo = <AuthGateConteudo auth={auth}>{children}</AuthGateConteudo>;
  if (!bancoConfigurado) {
    return (
      <FullScreenMessage>
        <p className="text-base font-medium text-foreground" data-testid="banco-nao-configurado">
          Banco de teste não configurado.
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Este endereço não é o Ellos oficial e não tem banco de teste definido, então nada foi carregado. Quem administra o ambiente precisa definir VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY na Vercel.
        </p>
      </FullScreenMessage>
    );
  }
  return (
    <>
      <FaixaAmbienteTeste />
      {conteudo}
    </>
  );
}

function AuthGateConteudo({ auth, children }: { auth: ReturnType<typeof useAuthContext>; children: ReactNode }) {

  useEffect(() => {
    if (auth?.status === "ready" && auth.migrated) {
      toast.success("Os dados que estavam neste navegador foram enviados para o servidor.");
    }
  }, [auth?.status, auth?.migrated]);

  if (!auth) return <>{children}</>;

  switch (auth.status) {
    case "loading":
    case "hydrating":
      return (
        <FullScreenMessage>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">
            {auth.status === "loading" ? "Abrindo o Ellos…" : "Carregando seus dados…"}
          </p>
        </FullScreenMessage>
      );
    case "signed-out":
      return <LoginPage />;
    case "recovering":
      return <LoginPage initialMode="new-password" />;
    case "no-access":
      return (
        <FullScreenMessage>
          <p className="text-base font-medium text-foreground">Esta conta ainda não tem acesso ao Ellos.</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Peça a quem administra o Ellos para cadastrar o seu e-mail na aba Usuários.
          </p>
          <Button variant="outline" onClick={() => void auth.signOut()}>
            Sair
          </Button>
        </FullScreenMessage>
      );
    case "error":
      return (
        <FullScreenMessage>
          <p className="text-base font-medium text-foreground">{auth.error}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Verifique a conexão com a internet e tente de novo.
          </p>
          <div className="flex gap-2">
            <Button onClick={auth.retry}>Tentar de novo</Button>
            <Button variant="outline" onClick={() => void auth.signOut()}>
              Sair
            </Button>
          </div>
        </FullScreenMessage>
      );
    default:
      return <>{children}</>;
  }
}
