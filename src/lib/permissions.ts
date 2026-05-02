// Permissões centralizadas (piloto — fácil de ajustar)
import type { AppRole } from "@/contexts/AuthContext";

export const canConfirmPayment = (roles: AppRole[]) => roles.includes("financeiro");
export const canRegisterPayment = (roles: AppRole[]) => roles.includes("financeiro");
export const canDeletePayment = (roles: AppRole[]) => roles.includes("financeiro");
export const canDeleteAttachment = (roles: AppRole[]) =>
  roles.includes("gerente") || roles.includes("financeiro");
export const canViewConfirmedBy = (roles: AppRole[]) =>
  roles.includes("gerente") || roles.includes("vendedor") || roles.includes("financeiro") || roles.includes("equipe");
export const canSeeAttachmentsTab = (roles: AppRole[]) => !roles.includes("artista") || roles.length > 1;
export const canViewFinanceiroAgenda = (roles: AppRole[]) => roles.includes("financeiro");
