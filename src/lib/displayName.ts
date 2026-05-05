// Resolve um nome amigável para exibição na UI.
// Ordem de prioridade:
// 1. profiles.nome
// 2. profiles.nome_display (se existir)
// 3. user_metadata.full_name / nome
// 4. Primeiro nome do e-mail formatado (capitalizado, sem números)
// 5. "Usuário"

export interface ResolveDisplayNameInput {
  profileNome?: string | null;
  profileNomeDisplay?: string | null;
  metadataFullName?: string | null;
  metadataNome?: string | null;
  email?: string | null;
}

function clean(v?: string | null): string | null {
  if (!v) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0];
}

function fromEmail(email?: string | null): string | null {
  const e = clean(email);
  if (!e) return null;
  const local = e.split("@")[0] ?? "";
  // remove números, separadores e pega o primeiro segmento
  const cleaned = local.replace(/[0-9]+/g, "").replace(/[._-]+/g, " ").trim();
  if (!cleaned) return null;
  const first = cleaned.split(/\s+/)[0];
  if (!first) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function resolveDisplayName(input: ResolveDisplayNameInput): string {
  const nome = clean(input.profileNome);
  if (nome) return firstName(nome);
  const nomeDisplay = clean(input.profileNomeDisplay);
  if (nomeDisplay) return firstName(nomeDisplay);
  const metaFull = clean(input.metadataFullName);
  if (metaFull) return firstName(metaFull);
  const metaNome = clean(input.metadataNome);
  if (metaNome) return firstName(metaNome);
  const fromMail = fromEmail(input.email);
  if (fromMail) return fromMail;
  return "Usuário";
}

export function hasRealName(input: ResolveDisplayNameInput): boolean {
  return Boolean(
    clean(input.profileNome) ||
      clean(input.profileNomeDisplay) ||
      clean(input.metadataFullName) ||
      clean(input.metadataNome)
  );
}
