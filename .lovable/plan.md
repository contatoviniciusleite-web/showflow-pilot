## Visão geral

Quatro melhorias na minuta de show + um novo módulo de Contratantes. Como é um piloto, todos os campos obrigatórios e máscaras ficam centralizados em utilitários reutilizáveis para fácil ajuste futuro.

---

## 1. Máscara monetária (R$ 10.000,00)

- Criar `src/lib/masks.ts` com:
  - `formatCurrencyBRL(rawDigits)` — recebe string só de dígitos e devolve `R$ 10.000,00`
  - `parseCurrencyBRL(masked)` → number (em reais)
  - `formatPhoneBR`, `formatCEP`, `formatCpfCnpj` (úteis também para o módulo de contratantes)
- Criar `src/components/ui/CurrencyInput.tsx` — wrapper sobre `<Input>` que mantém valor numérico interno e exibe máscara enquanto digita.
- Aplicar em:
  - `src/pages/Shows.tsx` — campo "Cachê total"
  - `src/components/dashboard/...` ou onde houver depósitos/despesas (procurar por `show_deposits` / `show_expenses` no código — atualmente `Shows.tsx` não tem UI de despesas; aplicar somente onde já existir input de valor).

## 2. Campos obrigatórios na minuta

Centralizar em uma constante:

```ts
const REQUIRED_FIELDS = [
  "artist_id", "data_show", "horario", "local", "cidade",
  "cache_total", "condicao_pagamento",
  "contratante_nome", "contratante_telefone", "contratante_email",
] as const;
```

- Função `validateShowForm(form)` retorna `Record<campo, string>` com erros.
- No JSX da minuta: cada campo passa a ler `errors[name]` e:
  - aplica `aria-invalid` + classe `border-destructive`
  - mostra `<p class="text-sm text-destructive">Este campo é obrigatório</p>` abaixo
- `save()` chama `validateShowForm`; se houver erros, faz `setErrors`, foca o primeiro campo inválido e aborta o envio.

## 3. Title Case automático

- Em `src/lib/masks.ts` adicionar `toTitleCase(str)` com tratamento para preposições PT-BR (`de`, `da`, `do`, `dos`, `das`, `e`).
- Criar componente `TitleCaseInput` que aplica `toTitleCase` em `onBlur` (não em cada tecla, para não quebrar acentuação enquanto o usuário digita).
- Aplicar em: `local`, `endereco`, `cidade`, `contratante_nome`, `contratante_endereco`, `contratante_cidade`, `vendedor`, `autorizado_por` e em todos os campos de texto livre do módulo de contratantes (exceto e-mail e CPF/CNPJ).

## 4. Módulo de Contratantes

### Banco

Nova tabela `contratantes`:

```
id uuid pk, nome text not null, documento text, endereco text,
cidade text, estado text, cep text, telefone text, email text,
observacoes text, created_by uuid, created_at, updated_at
```

RLS:
- SELECT: `gerente | financeiro | vendedor` (artista sem acesso)
- INSERT: `gerente | financeiro | vendedor`
- UPDATE: `gerente | financeiro`
- DELETE: `gerente`

Índice `idx_contratantes_nome_lower` para autocomplete.

Adicionar coluna opcional em `shows`: `contratante_id uuid` (nullable) — permite manter dados editados na minuta sem mexer no cadastro principal.

### Edge function

`supabase/functions/contratantes-admin/index.ts` com ações: `list`, `search` (q), `get` (id, retorna dados + histórico de shows do contratante), `create`, `update`, `delete`.

### Frontend

- Nova página `src/pages/Contratantes.tsx`:
  - Lista com busca, ações conforme papel
  - Drawer/Dialog de cadastro/edição
  - Ficha do contratante exibe shows vinculados (artista, data, local, valor)
- Rota `/contratantes` em `App.tsx` protegida por `["gerente","financeiro","vendedor"]`
- Item no menu lateral (`AppLayout.tsx`)
- No formulário da minuta:
  - Campo "Contratante" vira combobox com autocomplete (`Command` do shadcn) buscando via edge function
  - Selecionar → preenche os campos `contratante_*` e seta `contratante_id`
  - Editar campos não desfaz o vínculo, apenas sobrescreve no show
  - Checkbox "Salvar como novo contratante" aparece quando o vendedor digitou um nome novo

---

## Detalhes técnicos

- `src/lib/masks.ts`, `src/components/ui/CurrencyInput.tsx`, `src/components/ui/TitleCaseInput.tsx` — utilitários reutilizáveis
- Validação client-side em `Shows.tsx`; servidor (`shows-admin`) mantém validação mínima atual
- Migração SQL será proposta separadamente para aprovação antes do código frontend
- Configurabilidade: lista `REQUIRED_FIELDS` em constante única; máscaras isoladas em utilitário; nada hard-coded em JSX

---

## Ordem de execução

1. Migração: tabela `contratantes` + coluna `shows.contratante_id` + RLS
2. Edge function `contratantes-admin`
3. Utilitários (`masks.ts`, `CurrencyInput`, `TitleCaseInput`)
4. Refatorar `Shows.tsx` (máscara, validação, title case, autocomplete contratante)
5. Página `Contratantes.tsx` + rota + menu

Confirma para começar pela migração?