## Objetivo

Criar o perfil **Diretor** (único no sistema, autoriza shows e tem relatórios exclusivos), remover do **Gerente** a permissão de aprovar/rejeitar minutas, automatizar o campo "Autorizado por" e atualizar fluxo de notificações.

---

## 1. Banco de dados (migration)

**Enum `app_role`** — adicionar valor `'diretor'`.

**Tabela `shows`** — manter a coluna `autorizado_por` (texto), mas deixar de coletá-la no formulário. Adicionar:
- `autorizado_por_user_id uuid` — id do diretor que aprovou
- `autorizado_por_nome text` — nome do diretor no momento da aprovação
- `autorizado_em timestamptz` — data/hora da aprovação

**Restrição "apenas um Diretor"** — função + trigger em `user_roles` que bloqueia INSERT/UPDATE quando já existe um registro com `role='diretor'` para outro usuário, retornando a mensagem exata pedida.

**RLS atualizado:**
- `shows`: política de UPDATE (aprovação/rejeição) e a de criação ganham `diretor` quando faz sentido. Aprovação/rejeição passa a exigir `diretor`.
- Todas as policies que hoje liberam `gerente` para aprovar/rejeitar continuam liberando `gerente` para o resto, mas no edge function a regra de aprovação será restrita ao Diretor.
- Demais tabelas (contratantes, anexos, depósitos, despesas, parcelas, pagamentos): adicionar `diretor` aos checks onde `gerente` aparece (acesso total).

**Tela de Usuários** — passa a permitir atribuir o papel `diretor` (com tratamento do erro vindo da trigger).

## 2. Permissões no front (`src/lib/permissions.ts` + AppLayout/ProtectedRoute)

- Adicionar `AppRole` `"diretor"` em `AuthContext`.
- Helpers novos: `canApproveShow`, `canRejectShow` → apenas `diretor`.
- `canViewAutorizadoPor` → diretor, gerente, financeiro.
- Diretor enxerga toda a navegação que o Gerente enxerga + nova rota `/diretoria`.
- `ManagerModeContext`: diretor pode alternar para "modo vendedor" igual ao gerente (opcional — manter simples: só gerente alterna).

## 3. Edge functions

**`shows-admin`**:
- Ações `approve_show` / `reject_show` passam a exigir papel `diretor`. Ao aprovar, gravar `autorizado_por_user_id`, `autorizado_por_nome` (do profile) e `autorizado_em = now()`. Status vai para "Aguardando Dados Completos" (já existe).
- Ação `create_show`: ignorar/zerar `autorizado_por` enviado pelo cliente.
- Disparo de notificações:
  - Criação → notificar **Diretor** (busca user_roles where role='diretor').
  - Aprovação → notificar **Vendedor (created_by), Gerente(s), Financeiro(s)**.
  - Rejeição → notificar **Vendedor, Gerente(s)** com motivo.

**`my-roles`** — nada a mudar, já devolve roles atribuídos.

**`contratante-link`** / outras — sem mudança funcional, mas garantir que não tentem aprovar.

## 4. UI

**`src/pages/Shows.tsx`** (formulário de minuta):
- Remover input "Autorizado por".
- Botões "Aprovar" / "Rejeitar" ficam visíveis apenas para `diretor` (hoje aparecem para gerente/equipe).

**`src/components/shows/ShowDetailsModal.tsx`**:
- Bloco "Autorizado por [nome] em [data]" visível apenas para diretor/gerente/financeiro, montado a partir de `autorizado_por_nome` + `autorizado_em` (fallback para texto antigo).

**`src/pages/Usuarios.tsx`**:
- Adicionar opção "Diretor" no seletor de papel.
- Tratar erro retornado pela trigger e mostrar toast com a mensagem.

**Nova página `src/pages/Diretoria.tsx`** + rota `/diretoria` (protegida por `requireRoles=['diretor']`):
- Visão financeira consolidada (soma de cachês, pagos, saldo, despesas).
- Performance por artista (nº shows, faturamento, ticket médio).
- Performance por vendedor (nº minutas criadas, aprovadas, rejeitadas, faturamento).
- Histórico de shows aprovados/rejeitados/cancelados com motivo.

Implementação em uma única página com abas (`Tabs`) consumindo dados via Supabase client (RLS já libera diretor).

**`AppLayout.tsx`** — adicionar item "Diretoria" (icon `Crown`) visível só para diretor; incluir `diretor` nos itens que hoje listam `gerente`.

## 5. Notificações

Atualizar `supabase/functions/notifications/index.ts` (e/ou helpers em `shows-admin`) para que os disparos de "minuta criada/aprovada/rejeitada" usem as novas regras de destinatários descritas acima.

---

## Detalhes técnicos relevantes

- A trigger de unicidade do Diretor deve permitir UPDATE no próprio registro (mesmo `user_id`) e bloquear apenas quando outro user já tem o papel.
- Manter coluna `autorizado_por` antiga por compatibilidade (read-only); novos registros não a preenchem.
- Toda a verificação de permissão crítica (aprovar/rejeitar) é feita no edge function, não só no front.
- Sistema continua configurável: papéis e regras vivem em `permissions.ts` + RLS + edge function — fácil de ajustar depois.

## Fora do escopo desta entrega

- Promover automaticamente algum usuário existente a Diretor (será feito manualmente pela tela de Usuários).
- Modo Diretor → Vendedor (não pedido).
