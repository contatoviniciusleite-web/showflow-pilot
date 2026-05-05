export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Returns "+55XXXXXXXXXXX" for storage. Empty string if no digits. */
export function toStoredPhone(value: string): string {
  const d = phoneDigits(value);
  if (!d) return "";
  return `+55${d}`;
}

/** Strips leading +55 (and digits) for editing in the masked input. */
export function fromStoredPhone(value: string | null | undefined): string {
  if (!value) return "";
  const d = value.replace(/\D/g, "").replace(/^55/, "");
  return maskPhone(d);
}
