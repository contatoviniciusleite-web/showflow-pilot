import { Link } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { UserCircle2, ArrowRight } from "lucide-react";

export function CompleteProfileBanner() {
  const { profileComplete, loading } = useProfile();
  if (loading || profileComplete) return null;
  return (
    <div className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 flex items-center gap-3 text-sm">
      <UserCircle2 className="h-5 w-5 text-accent shrink-0" />
      <p className="flex-1 text-foreground">
        Complete seu perfil — adicione seu nome para personalizar sua experiência.
      </p>
      <Link
        to="/perfil"
        className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
      >
        Completar perfil <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
