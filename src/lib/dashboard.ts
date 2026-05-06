// Helpers e constantes para os dashboards. Mantidos centralizados
// para fácil ajuste durante a fase piloto.

export type Period = "semana" | "mes" | "ano";

export const PERIOD_LABEL: Record<Period, string> = {
  semana: "Semanal",
  mes: "Mensal",
  ano: "Anual",
};

export const DASHBOARD_THRESHOLDS = {
  contratoPendenteDias: 7,
};

export function fmtBRL(n: number) {
  return (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function toDateOnly(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Segunda a Domingo
export function getWeekRange(ref = new Date()) {
  const d = toDateOnly(ref);
  const day = d.getDay(); // 0=Dom .. 6=Sab
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

export function getMonthRange(ref = new Date()) {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

export function getYearRange(ref = new Date()) {
  const start = new Date(ref.getFullYear(), 0, 1);
  const end = new Date(ref.getFullYear(), 11, 31);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

export function getRangeFor(period: Period, ref = new Date()) {
  if (period === "semana") return getWeekRange(ref);
  if (period === "mes") return getMonthRange(ref);
  return getYearRange(ref);
}

export function inRange(dateIso: string, start: string, end: string) {
  return dateIso >= start && dateIso <= end;
}

// Soma cache_total considerando "minutas aprovadas" no sentido do produto
// (qualquer status pós-aprovação).
const APPROVED_STATUSES = new Set([
  "aprovada",
  "aguardando_pagamento",
  "comprovante_enviado", // legado
  "aguardando_dados",     // legado
  "aguardando_contratante", // legado
  "confirmado",
]);

export function isApprovedStatus(s: string) {
  return APPROVED_STATUSES.has(s);
}

export function sumCache<T extends { cache_total: number | string | null }>(rows: T[]) {
  return rows.reduce((acc, r) => acc + Number(r.cache_total ?? 0), 0);
}

export function monthLabel(m: number) {
  return ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][m];
}
