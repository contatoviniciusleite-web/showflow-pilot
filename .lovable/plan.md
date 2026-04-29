# Piloto — App de Gestão para Produtora Musical

App web para gerenciar 6 artistas: cadastro de shows (minutas), agenda unificada, financeiro, dashboard, relatórios e perfis de acesso. Em português, responsivo, com Supabase (Lovable Cloud) e integração com Google Calendar.

---

## Fase 1 — Fundação (Cloud + design + cadastros base)

1. **Ativar Lovable Cloud** (Supabase gerenciado) para banco, auth e edge functions.
2. **Design system** moderno e sóbrio em `index.css` + `tailwind.config.ts`:
   - Paleta neutra escura com 1 cor de destaque (ex: âmbar/dourado, evocando palco).
   - Tokens semânticos (primary, accent, surface, muted, success, warning, destructive).
   - Tipografia: Inter para UI, fonte display sutil para títulos.
   - Componentes shadcn customizados (Button, Card, Badge, Tabs, Dialog, Calendar).
3. **Esquema do banco** (migrations):
   - `profiles` (id ↔ auth.users, nome, avatar)
   - `app_role` enum (`gerente`, `equipe`, `artista`) + tabela `user_roles` + função `has_role` (security definer)
   - `artists` (id, nome, foto_url, google_calendar_id, rider_padrao text, user_id opcional p/ login do artista, cor hex)
   - `shows` (todos os campos da minuta, FK artist_id, created_by)
   - `show_deposits` (show_id, valor, data, responsavel, status)
   - `show_expenses` (show_id, categoria, descricao, valor, data)
   - `show_calendar_events` (show_id, artist_id, google_event_id) — para sync
   - View/coluna calculada `a_receber` e `lucro_liquido` (via SQL ou no client).
4. **RLS**:
   - Gerente: acesso total via `has_role`.
   - Equipe: insert/update em shows, deposits, expenses; sem delete.
   - Artista: select apenas onde `artist_id` corresponde ao seu vínculo.
5. **Auth**: Email/senha + Google. Tela de login/signup. Gerente cria usuários e atribui papel + artista vinculado.
6. **Cadastro inicial dos 6 artistas** (tela CRUD: nome, foto upload, calendar ID, rider padrão, cor).

## Fase 2 — Minuta de Show

Formulário em seções colapsáveis (acordeão) com todos os blocos pedidos:
- **Informações do Show** (artista, data, hora, local, tipo aberta/fechada, endereço, cidade, capacidade)
- **Financeiro** (cachê, condição de pagamento, depósitos repetíveis com valor/data/responsável/status, "A receber" calculado em tempo real, encargos sim/não)
- **Contratante** (nome, CPF/CNPJ com máscara, endereço, cidade, CEP, telefone, e-mail)
- **Transporte** (4 switches + observações)
- **Hospitalidade** (rider padrão do artista preenchido automaticamente e editável, 3 switches)
- **Controle Interno** (vendedor, data subida, autorizado por — default "Vitor D." editável)

Validação com Zod. Edição/duplicação/exclusão da minuta. Lista de shows com filtros.

## Fase 3 — Google Calendar

- **Conector Google Calendar** via Lovable Connectors (gateway, com refresh de token automático).
- **Edge function `sync-show-to-calendar`**: ao salvar minuta, cria/atualiza evento no calendário do artista (usa `google_calendar_id` do artista como `calendarId`). Salva `google_event_id` em `show_calendar_events`.
- Edge function `delete-calendar-event` ao excluir show.
- Observação: o conector autentica a conta do dono da produtora (uma conta Google que tem acesso aos calendários dos artistas via compartilhamento). Documentado na UI.

## Fase 4 — Agenda

- Componente de calendário (mês/semana) com todos os shows.
- Cor por artista (campo `cor` no cadastro).
- Filtro multi-seleção por artista.
- Clique no evento → drawer/modal com minuta completa + ficha financeira.

## Fase 5 — Financeiro

- Ficha financeira por show: cachê, depósitos recebidos, a receber, despesas lançadas, lucro líquido.
- CRUD de despesas por categoria (viagem, hospedagem, rider, outras, customizável).
- Alertas: parcelas com `status=Pendente` e `data <= hoje+7` aparecem no dashboard e em uma aba "Pendências".

## Fase 6 — Dashboard

- Cards: total a receber no mês, total recebido, total de despesas, lucro do mês.
- Timeline próximos shows (próximos 30 dias).
- Grid dos 6 artistas com mini-stats (próximo show, receita do mês).
- Filtros: artista + período (date range).

## Fase 7 — Relatórios

- Relatório financeiro por artista (mensal/anual) com tabela + gráfico.
- Histórico de shows por artista.
- Totais de shows e receita por período.
- Exportação CSV (nice-to-have).

## Fase 8 — Perfis e refinamentos

- Tela de gestão de usuários (gerente atribui papel + vincula a um artista quando role=artista).
- Navegação adaptada por papel (sidebar mostra só o que cada papel pode ver).
- Polish visual, responsivo mobile, estados de loading e empty states.

---

## Detalhes técnicos

- **Stack**: React 18 + Vite + TS + Tailwind + shadcn + React Router + TanStack Query + react-hook-form + Zod.
- **Backend**: Lovable Cloud (Supabase) — Postgres, Auth, RLS, Edge Functions (Deno).
- **Calendar**: Lovable Connector `google_calendar` via gateway (`https://connector-gateway.lovable.dev/google_calendar/calendar/v3`).
- **Roles**: enum + `user_roles` + `has_role()` SECURITY DEFINER (evita recursão de RLS).
- **Estrutura de pastas**:
  - `src/pages/`: Login, Dashboard, Shows (lista + form), Agenda, Financeiro, Relatorios, Artistas, Usuarios.
  - `src/components/shows/`: form em seções, lista, ficha financeira.
  - `src/components/agenda/`: calendário.
  - `src/components/dashboard/`: cards, timeline.
  - `src/integrations/supabase/` (auto-gerado).
  - `supabase/functions/sync-calendar-event/`.
- **Modo piloto**: campos sem hardcode, categorias de despesa em tabela própria editável, papéis configuráveis, rider editável por artista.

## O que vou pedir antes de começar

1. **Direção visual** — vou gerar 2–3 protótipos de design (dashboard) para você escolher.
2. **Conexão Google Calendar** — vou pedir para conectar a conta Google da produtora (que precisa ter acesso aos calendários dos 6 artistas via compartilhamento no Google).
3. **Cadastro dos 6 artistas** — você pode preencher depois pela tela de cadastro; não preciso dos nomes agora.

## Ordem de execução proposta

Vou entregar em iterações curtas, começando pela Fase 1 + 2 (fundação + minuta de show funcional), depois Calendar, depois Agenda+Financeiro, depois Dashboard+Relatórios, por fim Perfis. Após cada fase você testa e ajustamos.

Posso começar pela **Fase 1 (Cloud + design + cadastros base + auth)**?
