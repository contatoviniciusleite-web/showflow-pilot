// Máscaras e formatadores reutilizáveis (PT-BR)

export function onlyDigits(v: string): string {
  return (v ?? "").replace(/\D+/g, "");
}

/**
 * Formata centavos (string de dígitos) como moeda brasileira.
 * Ex: "1000000" -> "R$ 10.000,00"
 */
export function formatCurrencyBRLFromDigits(digits: string): string {
  const d = onlyDigits(digits);
  if (!d) return "";
  const cents = parseInt(d, 10);
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Converte número (reais) em string mascarada R$ x.xxx,xx */
export function formatCurrencyBRL(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Converte string mascarada para número em reais */
export function parseCurrencyBRL(masked: string): number {
  const d = onlyDigits(masked);
  if (!d) return 0;
  return parseInt(d, 10) / 100;
}

export function formatPhoneBR(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) =>
        [a && `(${a}`, a && a.length === 2 ? ") " : "", b, c && `-${c}`].filter(Boolean).join(""),
      )
      .trim();
  }
  return d.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
}

export function formatCEP(v: string): string {
  const d = onlyDigits(v).slice(0, 8);
  return d.replace(/^(\d{5})(\d{0,3}).*/, (_, a, b) => (b ? `${a}-${b}` : a));
}

export function formatCpfCnpj(v: string): string {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/^(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2}).*/, (_, a, b, c, e) =>
      [a, b && `.${b}`, c && `.${c}`, e && `-${e}`].filter(Boolean).join(""),
    );
  }
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2}).*/, (_, a, b, c, e, f) =>
    [a, b && `.${b}`, c && `.${c}`, e && `/${e}`, f && `-${f}`].filter(Boolean).join(""),
  );
}

const TITLE_LOWER = new Set(["de", "da", "do", "dos", "das", "e", "di", "du"]);

export function toTitleCase(input: string): string {
  if (!input) return "";
  return input
    .toLocaleLowerCase("pt-BR")
    .split(/(\s+)/)
    .map((tok, idx) => {
      if (/^\s+$/.test(tok)) return tok;
      if (idx > 0 && TITLE_LOWER.has(tok)) return tok;
      // mantém siglas curtas em maiúscula se o usuário digitou tudo maiúsculo? Não — sempre normaliza.
      return tok.charAt(0).toLocaleUpperCase("pt-BR") + tok.slice(1);
    })
    .join("");
}
