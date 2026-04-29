import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [artistId, setArtistId] = useState<string | null>(null);

  const loadRoles = async (uid: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role, artist_id")
      .eq("user_id", uid);
    if (error) {
      setRoles([]);
      setArtistId(null);
      return;
    }
    setRoles((data ?? []).map((r) => r.role as AppRole));
    const artist = (data ?? []).find((r) => r.role === "artista");
    setArtistId(artist?.artist_id ?? null);
  };

  useEffect(() => {
    // 1. Listener PRIMEIRO
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // defer chamada do supabase para evitar deadlock no listener
        setTimeout(() => loadRoles(sess.user.id), 0);
      } else {
        setRoles([]);
        setArtistId(null);
      }
    });

    // 2. Depois pega sessão atual
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) loadRoles(sess.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshRoles = async () => {
    if (user) await loadRoles(user.id);
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
