import { useAuthContext } from "@/contexts/AuthContext";

/**
 * Usuário logado (Supabase Auth). Mantém a mesma forma do hook antigo,
 * então as telas que usam `user.name` e `logout` continuam funcionando.
 */
type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(_options?: UseAuthOptions) {
  const auth = useAuthContext();
  const supabaseUser = auth?.user ?? null;
  const metadataName =
    (supabaseUser?.user_metadata?.full_name as string | undefined) ??
    (supabaseUser?.user_metadata?.name as string | undefined);
  const user = supabaseUser
    ? {
        id: supabaseUser.id,
        email: supabaseUser.email ?? null,
        name: metadataName || supabaseUser.email?.split("@")[0] || "Gestor",
        role: auth?.isAdmin ? ("admin" as const) : ("user" as const),
      }
    : null;

  return {
    user,
    loading: auth?.status === "loading" || auth?.status === "hydrating",
    error: null,
    isAuthenticated: Boolean(user),
    isAdmin: Boolean(auth?.isAdmin),
    refresh: async () => undefined,
    logout: async () => {
      await auth?.signOut();
    },
  };
}
