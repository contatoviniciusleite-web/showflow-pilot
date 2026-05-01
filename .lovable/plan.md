## Objetivo

Permitir que o usuário com perfil **Gerente** alterne, a qualquer momento, entre dois modos de trabalho — **Gerência** (padrão) e **Vendedor** — refletindo imediatamente o dashboard, navegação e regras de criação. Quando o gerente cria uma minuta no Modo Vendedor e ele mesmo aprova depois (no Modo Gerência), o sistema marca a minuta como **auto-aprovada**, mantendo todas as travas de negócio existentes.

## O que será entregue

1. **Toggle de modo** no topo do app (visível apenas para Gerente), com destaque visual do modo ativo.
2. **Modo Vendedor** para Gerente: dashboard idêntico ao do Vendedor (apenas suas próprias minutas), navegação reduzida, criação normal.
3. **Auto-aprovação registrada**: quando o aprovador é o mesmo usuário que criou a minuta, marcamos um flag e exibimos um badge amarelo "Auto aprovado" na lista da Gerência.
4. **Painel de auditoria** dentro do Dashboard de Gerência listando todas as minutas auto-aprovadas com filtro de período (Semanal/Mensal/Anual) — gerente, artista, data do show e valor.
5. **Travas mantidas**: cachê mínimo, limite de 3 shows/dia/artista, datas bloqueadas e fluxo de pagamento continuam idênticos.

## Detalhes técnicos

### Banco de dados (migração)

Adicionar duas colunas em `public.shows`:

- `auto_aprovado boolean not null default false`
- `auto_aprovado_em timestamptz null`

Não muda RLS — segue regra atual.

### Backend (`supabase/functions/shows-admin/index.ts`)

- Na ação `approve`: se `show.created_by === userId` (gerente aprovando a própria minuta), gravar `auto_aprovado = true`, `auto_aprovado_em = now()`. Caso contrário, gravar `false` (já é o default).
- Retornar as novas colunas no `select *` existente (já incluído).
- Nenhuma trava de negócio é afetada — `cache_total`, blocos de data e limite de 3 shows/dia continuam aplicados em `create`/`update`.

### Frontend

**Estado global do modo** (`src/contexts/ManagerModeContext.tsx`):

- Provider que expõe `mode: "gerencia" | "vendedor"` e `setMode()`.
- Persistência em `localStorage` (`stage.manager_mode`); padrão = `"gerencia"`.
- Só tem efeito quando `roles.includes("gerente")`. Para outros perfis, o valor efetivo é ignorado.
- Hook `useEffectiveRoles()` que devolve os papéis "vistos" pelo app: se gerente em modo Vendedor → `["vendedor"]`; senão → roles reais.

**Toggle visual** (`src/components/ManagerModeToggle.tsx`):

- Pill com dois botões: "👑 Gerência | 🤝 Vendedor".
- Renderizado em `AppLayout` (topo desktop + barra mobile) somente para gerente.
- Modo ativo destacado com `bg-accent text-accent-foreground`.

**Navegação e roteamento** (`AppLayout.tsx`, `ProtectedRoute.tsx`):

- Filtro do menu lateral passa a usar `useEffectiveRoles()` em vez de `roles`.
- Em Modo Vendedor, gerente vê apenas: Dashboard, Shows, Agenda (opcional manter), Financeiro removido do menu.
- `ProtectedRoute` continua usando os papéis reais (segurança), apenas a UI de navegação respeita o modo.

**Dashboard** (`src/pages/Dashboard.tsx`):

- Passa a checar primeiro o modo: se gerente em modo vendedor → renderiza `<VendedorDashboard />`. Senão, mantém a lógica atual.

**Lista de Shows** (`src/pages/Shows.tsx`):

- O backend já filtra corretamente por `created_by` para vendedor. Para gerente em modo vendedor, vamos enviar um parâmetro `as_role: "vendedor"` na chamada `list` para forçar o filtro como vendedor (alternativa: filtrar no cliente). Implementação escolhida: **filtrar no cliente** quando `mode === "vendedor"` para evitar mudar o backend; o gerente já recebe todas as shows, basta filtrar `created_by === user.id`. Mais simples e mantém RLS intacto.

**Badge "Auto aprovado"**:

- Em qualquer lista da Gerência (Shows, Dashboard de Gerência), quando `show.auto_aprovado === true`, renderizar `<Badge className="bg-yellow-500/15 text-yellow-700 border-yellow-500/30">Auto aprovado</Badge>` ao lado do status.

**Painel de auditoria** (novo bloco em `GerenciaDashboard.tsx`):

- Card "Auto-aprovações" com filtro de período (Semanal/Mensal/Anual reaproveitando `PeriodFilter`).
- Tabela: Gerente (nome via `profiles`), Artista, Data do show, Valor (`fmtBRL`).
- Fonte: shows com `auto_aprovado = true` e `data_show` no range; nomes de gerente buscados em batch via `profiles` (já permitido pela RLS para gerente).

### Tipos

`src/integrations/supabase/types.ts` é regenerado automaticamente após a migração — não editar manualmente.

## Fora de escopo

- Mudanças nas regras de cachê mínimo, limite de 3 shows/dia ou bloqueios de data (já implementadas e mantidas).
- Reescrever o fluxo de aprovação para outros papéis.
