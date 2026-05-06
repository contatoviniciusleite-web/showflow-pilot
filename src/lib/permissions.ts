// Permissões centralizadas (piloto — fácil de ajustar)
import type { AppRole } from "@/contexts/AuthContext";

export const isDiretor = (roles: AppRole[]) => roles.includes("diretor");
export const isGerente = (roles: AppRole[]) => roles.includes("gerente");

// Acesso "total" do sistema: Diretor e Gerente.
export const hasFullAccess = (roles: AppRole[]) =>
  roles.includes("diretor") || roles.includes("gerente");

// Aprovar/rejeitar minutas: APENAS Diretor.
export const canApproveShow = (roles: AppRole[]) => roles.includes("diretor");
export const canRejectShow = (roles: AppRole[]) => roles.includes("diretor");

// Quem vê a info "Autorizado por [diretor] em [data]"
export const canViewAutorizadoPor = (roles: AppRole[]) =>
  roles.includes("diretor") || roles.includes("gerente") || roles.includes("financeiro");

// Quem pode acessar relatórios da Diretoria
export const canAccessDiretoria = (roles: AppRole[]) => roles.includes("diretor");

export const canConfirmPayment = (roles: AppRole[]) => roles.includes("financeiro");
export const canRegisterPayment = (roles: AppRole[]) => roles.includes("financeiro");
export const canDeletePayment = (roles: AppRole[]) => roles.includes("financeiro");
export const canDeleteAttachment = (roles: AppRole[]) =>
  roles.includes("gerente") || roles.includes("financeiro") || roles.includes("diretor");
export const canViewConfirmedBy = (roles: AppRole[]) =>
  roles.includes("gerente") || roles.includes("vendedor") || roles.includes("financeiro") || roles.includes("equipe") || roles.includes("diretor");
export const canSeeAttachmentsTab = (roles: AppRole[]) => !roles.includes("artista") || roles.length > 1;
export const canViewFinanceiroAgenda = (roles: AppRole[]) => roles.includes("financeiro");

// Pagamentos / Fornecedores
export const canManagePaymentOrders = (roles: AppRole[]) => roles.includes("financeiro");
export const canViewPaymentOrders = (roles: AppRole[]) =>
  roles.includes("financeiro") || roles.includes("diretor");
export const canManageFornecedores = (roles: AppRole[]) =>
  roles.includes("financeiro") || roles.includes("diretor");

// Financeiro da Produtora
export const canViewProducerFinance = (roles: AppRole[]) =>
  roles.includes("financeiro") || roles.includes("diretor");
export const canManageProducerFinance = (roles: AppRole[]) => roles.includes("financeiro");
