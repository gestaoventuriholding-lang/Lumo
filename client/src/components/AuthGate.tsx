import type { ReactNode } from "react";
import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/contexts/AuthContext";
import LoginPage from "@/pages/Login";

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
export default function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuthContext();

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
            {auth.status === "loading" ? "Abrindo o Lumo…" : "Carregando seus dados…"}
          </p>
        </FullScreenMessage>
      );
    case "signed-out":
      return <LoginPage />;
    case "recovering":
      return <LoginPage initialMode="new-password" />;
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
