import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from "react";
import { useAuth, AppRole } from "@/contexts/AuthContext";

export type ManagerMode = "gerencia" | "vendedor";

const STORAGE_KEY = "stage.manager_mode";

interface ManagerModeState {
  mode: ManagerMode;
  setMode: (m: ManagerMode) => void;
  isManager: boolean;
}

const Ctx = createContext<ManagerModeState | undefined>(undefined);

export function ManagerModeProvider({ children }: { children: ReactNode }) {
  const { roles } = useAuth();
  const isManager = roles.includes("gerente");

  const [mode, setModeState] = useState<ManagerMode>(() => {
    if (typeof window === "undefined") return "gerencia";
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "vendedor" ? "vendedor" : "gerencia";
  });

  // Quando o usuário não é gerente, força modo gerencia (sem efeito de qualquer forma).
  useEffect(() => {
    if (!isManager && mode !== "gerencia") setModeState("gerencia");
  }, [isManager, mode]);

  const setMode = (m: ManagerMode) => {
    setModeState(m);
    try {
      window.localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  };

  return <Ctx.Provider value={{ mode, setMode, isManager }}>{children}</Ctx.Provider>;
}

export function useManagerMode() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useManagerMode fora do ManagerModeProvider");
  return ctx;
}

/**
 * Papéis "vistos" pelo app conforme o modo selecionado.
 * Gerente em Modo Vendedor → comporta-se como ["vendedor"].
 * Caso contrário, devolve os papéis reais.
 */
export function useEffectiveRoles(): AppRole[] {
  const { roles } = useAuth();
  const { mode, isManager } = useManagerMode();
  return useMemo(() => {
    if (isManager && mode === "vendedor") return ["vendedor"];
    return roles;
  }, [roles, isManager, mode]);
}
