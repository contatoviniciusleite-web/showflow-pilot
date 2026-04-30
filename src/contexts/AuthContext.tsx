import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "gerente" | "equipe" | "artista";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  rolesLoading: boolean;
  roles: AppRole[];
  artistId: string | null;
  refreshRoles: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const ROLE_RETRY_DELAYS = [800, 1600, 3000];
const ROLE_QUERY_TIMEOUT_MS = 10000;
const SESSION_TIMEOUT_MS = 8000;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

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
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [artistId, setArtistId] = useState<string | null>(null);
  const roleLoadId = useRef(0);

  const loadRoles = useCallback(async (uid: string, accessToken: string, clearBefore = false) => {
    const requestId = ++roleLoadId.current;
    let lastError: unknown = null;
    setRolesLoading(true);

    if (clearBefore) {
      setRoles([]);
      setArtistId(null);
    }

    for (let attempt = 0; attempt <= ROLE_RETRY_DELAYS.length; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), ROLE_QUERY_TIMEOUT_MS);
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/user_roles?select=role,artist_id&user_id=eq.${encodeURIComponent(uid)}`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              authorization: `Bearer ${accessToken}`,
            },
            signal: controller.signal,
          }
        ).finally(() => window.clearTimeout(timeout));

        const data = response.ok ? await response.json() : null;
        const error = response.ok ? null : await response.text();

        if (!error) {
          if (requestId === roleLoadId.current) {
            const newRoles = (data ?? []).map((r) => r.role as AppRole);
            console.log("[Auth] Papéis carregados:", newRoles);
            setRoles(newRoles);
            const artist = (data ?? []).find((r) => r.role === "artista");
            setArtistId(artist?.artist_id ?? null);
            setRolesLoading(false);
          }
          return;
        }

        console.warn("[Auth] Erro ao buscar papéis (tentativa " + attempt + "):", error);
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
      setRolesLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1. Listener PRIMEIRO
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setLoading(false);
        // defer chamada do supabase para evitar deadlock no listener
        setTimeout(() => void loadRoles(sess.user.id, sess.access_token), 0);
      } else {
        roleLoadId.current += 1;
        setRoles([]);
        setArtistId(null);
        setRolesLoading(false);
        setLoading(false);
      }
    });

    // 2. Depois pega sessão atual
    withTimeout(supabase.auth.getSession(), SESSION_TIMEOUT_MS)
      .then(async ({ data: { session: sess } }) => {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) void loadRoles(sess.user.id, sess.access_token);
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
    if (user && session) await loadRoles(user.id, session.access_token, true);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, rolesLoading, roles, artistId, refreshRoles, signOut }}>
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
