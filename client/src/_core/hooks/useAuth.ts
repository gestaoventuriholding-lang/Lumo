/**
 * Autenticação local.
 *
 * O login do Manus foi removido para o Lumo rodar em qualquer hospedagem.
 * Enquanto não houver um provedor de login próprio (ex.: Supabase Auth),
 * o app funciona sem usuário autenticado e mostra o gestor padrão.
 * Mantém a mesma forma de retorno do hook antigo para não quebrar as telas.
 */
type AuthUser = { name?: string | null; email?: string | null } | null;

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(_options?: UseAuthOptions) {
  const user: AuthUser = null;
  return {
    user,
    loading: false,
    error: null,
    isAuthenticated: false,
    refresh: async () => undefined,
    logout: async () => undefined,
  };
}
