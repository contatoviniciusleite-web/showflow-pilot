import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { resolveDisplayName, hasRealName } from "@/lib/displayName";

interface ProfileRow {
  id: string;
  nome: string | null;
  telefone?: string | null;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, nome, telefone")
      .eq("id", user.id)
      .maybeSingle();
    setProfile((data as ProfileRow) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const displayName = resolveDisplayName({
    profileNome: profile?.nome,
    metadataFullName: (user?.user_metadata as Record<string, unknown> | undefined)?.full_name as string | undefined,
    metadataNome: (user?.user_metadata as Record<string, unknown> | undefined)?.nome as string | undefined,
    email: user?.email,
  });

  const profileComplete = hasRealName({
    profileNome: profile?.nome,
    metadataFullName: (user?.user_metadata as Record<string, unknown> | undefined)?.full_name as string | undefined,
    metadataNome: (user?.user_metadata as Record<string, unknown> | undefined)?.nome as string | undefined,
  });

  return { profile, loading, reload, displayName, profileComplete };
}
