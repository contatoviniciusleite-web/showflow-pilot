
# Dashboards personalizados por perfil

Reescrever `src/pages/Dashboard.tsx` para entregar três experiências distintas, cada usuário cai automaticamente no painel do seu papel após login. Filtro de período (Semanal / Mensal / Anual) presente em todos os dashboards. Semana = segunda a domingo. Dados em tempo real via Supabase Realtime na tabela `shows`.

## 1. Dashboard do Vendedor

Mostra apenas minutas criadas pelo próprio usuário (a edge function `shows-admin` já filtra por `created_by` quando o papel é vendedor).

- **Cards de resumo** (sensíveis ao filtro de período pela `data_show`):
  - Total de minutas criadas
  - Pendentes / Aprovadas / Rejeitadas / Canceladas
  - Volume financeiro = soma de `cache_total` das minutas aprovadas (`status` ∈ {aprovada, aguardando_pagamento, comprovante_enviado, confirmado})
- **Filtros**: Semana atual (seg–dom) / Mês atual / Ano atual
- **Lista de minutas**: data do show, artista, cidade, valor, badge colorido por `STATUS_CLASS`
- "Rejeitadas" inferido pelas notificações `minuta_rejeitada` no período (já existe esse tipo no fluxo).

## 2. Dashboard do Artista

Mostra apenas shows do artista logado (já filtrado por `get_my_artist_id()` no backend).

- **Cards**:
  - Próximos shows da semana atual (seg–dom)
  - Quantidade de shows na semana
  - Faturamento total da semana
  - Cachê total recebido no mês (status `confirmado`)
- **Agenda pessoal**: lista cronológica de próximos shows com destaque visual nos da semana corrente.
- **Financeiro pessoal**: para cada show da semana/mês — status de pagamento (badge) + valor; abaixo, histórico dos shows passados com valores.

## 3. Dashboard Gerência / Financeiro

Visão consolidada da operação. Filtro de período aplicado a cards/listas/gráficos.

- **Alertas no topo (cards destacados)**:
  - Shows com pagamento atrasado (vermelho): `aguardando_pagamento` com `prazo_comprovante_em < now()`
  - Contratos pendentes há +7 dias: `pendente` com `created_at < now() - 7d`
  - Shows cancelados no mês
  - Minutas aguardando aprovação (`pendente`)
- **Visão por artista**: card individual com shows confirmados no mês, faturamento do mês e próximo show.
- **Performance de vendedores**: ranking por volume financeiro, total de minutas, taxa de aprovação (aprovadas vs rejeitadas no período).
- **Shows do mês**: lista com filtros por artista e status; totais "a receber", "recebido" e "em aberto".
- **Gráficos** (Recharts, já disponível via `@/components/ui/chart`):
  - Linha: evolução mensal de faturamento
  - Barras: shows por artista no período
  - Linha: comparativo mensal vs ano anterior

## Detalhes técnicos

- **Sem alterações no schema** — toda a lógica é client-side em cima de `shows-admin.list` (já respeita papéis via RLS).
- **Componentização**: criar `src/components/dashboard/` com:
  - `PeriodFilter.tsx` (toggle Semana/Mês/Ano)
  - `VendedorDashboard.tsx`
  - `ArtistaDashboard.tsx`
  - `GerenciaDashboard.tsx`
  - `StatCard.tsx` (extraído do atual)
  - Helpers `lib/dashboard.ts` para `getWeekRange` (segunda–domingo), `getMonthRange`, `getYearRange`, agregadores e formatters.
- **Realtime**: `supabase.channel('shows-dash').on('postgres_changes', { schema: 'public', table: 'shows' }, refetch).subscribe()`. Habilitar replicação na tabela `shows` via migração:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shows;
  ALTER TABLE public.shows REPLICA IDENTITY FULL;
  ```
- **Roteamento**: `Dashboard.tsx` continua sendo o componente da rota `/`; ele detecta o papel (preferência: gerente/financeiro > artista > vendedor > equipe) e renderiza o dashboard correspondente.
- **Configurabilidade futura**: cores e thresholds (dias de contrato pendente, etc.) ficam em constantes em `lib/dashboard.ts` para fácil ajuste — alinhado com a observação de "piloto em fase de testes".

## Ordem de implementação

1. Migração realtime (`shows`).
2. Helpers + componentes compartilhados (`PeriodFilter`, `StatCard`, `lib/dashboard.ts`).
3. `VendedorDashboard`.
4. `ArtistaDashboard`.
5. `GerenciaDashboard` (cards de alerta → artistas → vendedores → lista → gráficos).
6. Reescrever `Dashboard.tsx` como roteador por papel + assinatura realtime.
