import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "gerente" | "equipe" | "artista";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  artistId: string | null;
  refreshRoles: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const ROLE_RETRY_DELAYS = [700, 1500, 3000, 5000];
const ROLE_QUERY_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Tempo limite ao carregar permissões")), timeoutMs);
    Promise.resolve(promise)
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeout));
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [artistId, setArtistId] = useState<string | null>(null);
  const roleLoadId = useRef(0);

  const loadRoles = useCallback(async (uid: string, clearBefore = false) => {
    const requestId = ++roleLoadId.current;
    let lastError: unknown = null;

    if (clearBefore) {
      setRoles([]);
      setArtistId(null);
    }

    for (let attempt = 0; attempt <= ROLE_RETRY_DELAYS.length; attempt += 1) {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from("user_roles")
            .select("role, artist_id")
            .eq("user_id", uid),
          ROLE_QUERY_TIMEOUT_MS
        );

        if (!error) {
          if (requestId === roleLoadId.current) {
            setRoles((data ?? []).map((r) => r.role as AppRole));
            const artist = (data ?? []).find((r) => r.role === "artista");
            setArtistId(artist?.artist_id ?? null);
          }
          return;
        }

        lastError = error;
      } catch (error) {
        lastError = error;
      }

      const delay = ROLE_RETRY_DELAYS[attempt];
      if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
    }

    console.error("Falha ao carregar permissões do usuário", lastError);
    if (requestId === roleLoadId.current) {
      setRoles([]);
      setArtistId(null);
    }
  }, []);

  useEffect(() => {
    // 1. Listener PRIMEIRO
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setLoading(true);
        // defer chamada do supabase para evitar deadlock no listener
        setTimeout(async () => {
          try {
            await loadRoles(sess.user.id);
          } finally {
            setLoading(false);
          }
        }, 0);
      } else {
        roleLoadId.current += 1;
        setRoles([]);
        setArtistId(null);
        setLoading(false);
      }
    });

    // 2. Depois pega sessão atual
    supabase.auth.getSession()
      .then(async ({ data: { session: sess } }) => {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) await loadRoles(sess.user.id);
      })
      .catch((error) => {
        console.error("Falha ao recuperar sessão", error);
        setSession(null);
        setUser(null);
      })
      .finally(() => setLoading(false));

    return () => sub.subscription.unsubscribe();
  }, [loadRoles]);

  const refreshRoles = async () => {
    if (user) await loadRoles(user.id, true);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, roles, artistId, refreshRoles, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}

export function useHasRole(role: AppRole) {
  const { roles } = useAuth();
  return roles.includes(role);
}

export function useIsManager() {
  return useHasRole("gerente");
}
