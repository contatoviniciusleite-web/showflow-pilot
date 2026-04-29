import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { AppRole, useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface Props {
  children: ReactNode;
  requireRoles?: AppRole[]; // se passado, exige pelo menos um desses
}

export function ProtectedRoute({ children, requireRoles }: Props) {
  const { user, loading, roles } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  if (requireRoles && requireRoles.length > 0) {
    const ok = requireRoles.some((r) => roles.includes(r));
    if (!ok) return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
