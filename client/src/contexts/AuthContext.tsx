import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { disableCloud, flushCloud, hydrateCloud } from "@/lib/cloudStore";

type Status = "loading" | "signed-out" | "recovering" | "hydrating" | "ready" | "no-access" | "error";

interface AuthContextValue {
  status: Status;
  user: User | null;
  isAdmin: boolean;
  error: string | null;
  migrated: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  sendPasswordReset: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar. Veja a mensagem que chegou na sua caixa de entrada.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";
  if (m.includes("password should be at least")) return "A senha precisa ter pelo menos 8 caracteres.";
  if (m.includes("network") || m.includes("fetch")) return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [migrated, setMigrated] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      userIdRef.current = data.session?.user.id ?? null;
      setSession(data.session);
      setStatus(data.session ? "hydrating" : "signed-out");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") {
        setSession(next);
        setStatus("recovering");
        return;
      }
      if (event === "SIGNED_OUT") {
        userIdRef.current = null;
        disableCloud();
        setSession(null);
        setIsAdmin(false);
        setStatus("signed-out");
        return;
      }
      if (event === "SIGNED_IN" && next) {
        if (userIdRef.current !== next.user.id) {
          userIdRef.current = next.user.id;
          setStatus((s) => (s === "recovering" ? s : "hydrating"));
        }
        setSession(next);
        return;
      }
      if (next) setSession(next);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  // Carrega os dados do banco depois do login.
  const sessionUserId = session?.user.id ?? null;
  useEffect(() => {
    if (status !== "hydrating" || !sessionUserId) return;
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        // Só entra quem é administrador ou foi cadastrado na aba Usuários.
        const [adminResult, memberResult] = await Promise.all([
          supabase.from("admins").select("user_id").eq("user_id", sessionUserId).maybeSingle(),
          supabase.from("members").select("user_id").eq("user_id", sessionUserId).maybeSingle(),
        ]);
        if (cancelled) return;
        if (adminResult.error && memberResult.error) throw adminResult.error;
        const admin = Boolean(adminResult.data);
        if (!admin && !memberResult.data && !memberResult.error) {
          setIsAdmin(false);
          setStatus("no-access");
          return;
        }
        const { migrated: didMigrate } = await hydrateCloud(sessionUserId);
        if (cancelled) return;
        setIsAdmin(admin);
        setMigrated(didMigrate);
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        console.error("[Elos] Falha ao carregar dados", e);
        setError("Não foi possível carregar os dados do servidor.");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, sessionUserId, supabase, attempt]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      return signInError ? translateAuthError(signInError.message) : null;
    },
    [supabase]
  );

  const sendPasswordReset = useCallback(
    async (email: string) => {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      return resetError ? translateAuthError(resetError.message) : null;
    },
    [supabase]
  );

  const updatePassword = useCallback(
    async (password: string) => {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) return translateAuthError(updateError.message);
      setStatus("hydrating");
      return null;
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    await flushCloud();
    await supabase.auth.signOut();
    window.location.assign("/");
  }, [supabase]);

  const retry = useCallback(() => {
    setStatus("hydrating");
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      isAdmin,
      error,
      migrated,
      signIn,
      sendPasswordReset,
      updatePassword,
      signOut,
      retry,
    }),
    [status, session, isAdmin, error, migrated, signIn, sendPasswordReset, updatePassword, signOut, retry]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue | null {
  return useContext(AuthContext);
}
