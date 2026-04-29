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
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, artist_id")
        .eq("user_id", uid);

      if (!error) {
        if (requestId === roleLoadId.current) {
          setRoles((data ?? []).map((r) => r.role as AppRole));
          const artist = (data ?? []).find((r) => r.role === "artista");
          setArtistId(artist?.artist_id ?? null);
        }
        return;
      }

      lastError = error;
      const delay = ROLE_RETRY_DELAYS[attempt];
      if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
    }

    console.error("Falha ao carregar permissões do usuário", lastError);
    if (requestId === roleLoadId.current) {
      setRoles([]);
      setArtistId(null);
    }
  }, [loadRoles]);

  useEffect(() => {
    // 1. Listener PRIMEIRO
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setLoading(true);
        // defer chamada do supabase para evitar deadlock no listener
        setTimeout(async () => {
          await loadRoles(sess.user.id);
          setLoading(false);
        }, 0);
      } else {
        roleLoadId.current += 1;
        setRoles([]);
        setArtistId(null);
        setLoading(false);
      }
    });

    // 2. Depois pega sessão atual
    supabase.auth.getSession().then(async ({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) await loadRoles(sess.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

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
