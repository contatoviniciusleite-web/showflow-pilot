# Módulo de Fechamento Semanal

Substitui a planilha manual da produtora. Permite criar fechamentos semanais por artista, calcular distribuição automática (artista + sócios + impostos) e exportar PDF.

## 1. Banco de dados (migration única)

Criar 7 tabelas com RLS:

- `artist_financial_config` — `artista_percentual`, `imposto_percentual` (1 linha por artista, unique)
- `artist_partners` — sócios (`nome`, `funcao`, `percentual`, `ativo`, `ordem`)
- `artist_crew` — equipe base (`nome`, `funcao`, `cache_por_show`, `ativo`, `ordem`)
- `weekly_closings` — cabeçalho (`semana_inicio`, `semana_fim`, `status`, totais, auditoria)
- `weekly_closing_shows` — shows incluídos no fechamento (`cache_total`, `comissao_vendedor`, `incluido`)
- `weekly_closing_crew` — equipe do fechamento (`shows_participados`, `total_receber`)
- `weekly_closing_expenses` — despesas variáveis (`categoria`, `responsavel`, `incluir_no_calculo`)
- `weekly_closing_distribution` — distribuição calculada (`tipo`, `percentual`, `valor_bruto`, `imposto_valor`, `valor_liquido`)

**RLS:**
- Config por artista (`artist_financial_config`, `artist_partners`, `artist_crew`): SELECT autenticados; ALL para `gerente`/`diretor`.
- Fechamentos (todas as tabelas `weekly_*`): SELECT para `gerente`/`diretor`/`financeiro`; INSERT/UPDATE/DELETE apenas `gerente`/`diretor`. Bloqueio quando status = `finalizado` via trigger.
- Trigger `prevent_edit_finalized()` em `weekly_closings` e tabelas filhas: bloqueia UPDATE/DELETE/INSERT em closing finalizado (exceto `gerente`/`diretor` reabrindo).
- Triggers `set_updated_at` reutilizando função existente.

## 2. Configuração financeira do artista

Editar `src/pages/Artistas.tsx`: adicionar aba **"Configuração Financeira"** (visível só para `diretor`/`gerente`) no modal de detalhe do artista, com 3 seções:

- **Geral**: % artista + % imposto (form único)
- **Sócios e parceiros**: tabela CRUD com validação `soma(% sócios) + % artista ≤ 100%` (aviso visual)
- **Equipe base**: tabela CRUD (nome, função, cachê)

Componente novo: `src/components/artists/FinancialConfigTab.tsx`.

## 3. Página de Fechamentos

**Rota** `/fechamento` (lazy) registrada em `src/App.tsx`. Adicionar item **"Fechamentos"** no menu (`AppLayout.tsx`) entre Financeiro e Relatórios, ícone `Wallet`/`FileSpreadsheet`, roles `["diretor", "gerente", "financeiro"]`.

### Tela 1 — Lista (`src/pages/Fechamento.tsx`)

- Filtros: artista, período (date range)
- Tabela: artista, semana (DD/MM–DD/MM), status (badge), total bruto, sobra, criado por, data
- Botão **"Novo fechamento"** abre dialog passo 1

### Tela 2 — Criar (dialog `NewClosingDialog.tsx`)

- Select artista
- Date picker da semana (auto-snap para segunda → domingo via `date-fns/startOfWeek`/`endOfWeek` com `weekStartsOn: 1`)
- Preview: lista de shows confirmados encontrados na semana
- Confirmar → cria `weekly_closings` + popula `weekly_closing_shows` (do shows confirmados, com cache do show e comissão = 10% padrão ou cache do vendedor) + popula `weekly_closing_crew` a partir de `artist_crew` ativos com `shows_participados = total_shows`
- Redireciona para Tela 3

### Tela 3 — Editar fechamento (`/fechamento/:id` → `FechamentoDetalhe.tsx`)

5 seções editáveis com cálculo reativo:

- **A. Shows**: tabela editável (toggle incluir, valor, comissão)
- **B. Equipe**: tabela editável + botão adicionar; total = `cache_por_show × shows_participados`
- **C. Despesas**: tabela CRUD com categorias (Van/Clipe/Equipamento/Figurino/Ensaio/Outros) e flag "Incluir no cálculo"
- **D. Cálculo automático** (read-only, `useMemo`):
  ```
  bruto = Σ shows incluídos
  comissoes = Σ comissão vendedor (shows incluídos)
  equipe = Σ total_receber
  despesas = Σ valor (incluir_no_calculo = true)
  sobra = bruto - comissoes - equipe - despesas
  
  Para cada participante (artista + sócios ativos):
    bruto_p = sobra × (% / 100)
    imposto_p = bruto_p × (imposto% / 100)
    liquido_p = bruto_p - imposto_p
  
  Diferença para 100% → linha "Produtora" automática
  ```
- **E. Observações**: textarea

**Ações:**
- **Salvar rascunho** — upsert em todas as tabelas filhas
- **Finalizar** — confirm dialog → status `finalizado`, persiste distribuição calculada em `weekly_closing_distribution`, registra `finalizado_por`/`finalizado_em`
- **Exportar PDF** — sempre disponível
- Quando status = `finalizado` e usuário não é diretor/gerente → tudo readonly. Botão "Reabrir" para diretor/gerente.

### PDF (`src/lib/closingPdf.ts`)

Reusa `jsPDF + autotable` (igual `exporters.ts`). Layout:

- Cabeçalho: ARTISTA | MÊS | SEMANA N | ANO
- Tabela 1 — Shows (colunas conforme planilha original)
- Tabela 2 — Equipe (nome, função, cachê, shows, total)
- Despesas (lista)
- Distribuição: para cada participante `NOME [X%]: BRUTO Rx | IMPOSTO Ry | LÍQUIDO Rz`
- Rodapé com totais consolidados

## 4. Permissões e detalhes técnicos

- `diretor`/`gerente`: full
- `financeiro`: visualizar + exportar PDF (botões create/edit ocultos)
- `vendedor`/`artista`: sem rota (proteção via `ProtectedRoute` + check de role na página)

Hook utilitário `useFinancialConfig(artistId)` para buscar config + sócios + crew.

## Arquivos

**Novos:**
- `supabase/migrations/<ts>_weekly_closings.sql`
- `src/pages/Fechamento.tsx`
- `src/pages/FechamentoDetalhe.tsx`
- `src/components/fechamento/NewClosingDialog.tsx`
- `src/components/fechamento/ShowsSection.tsx`
- `src/components/fechamento/CrewSection.tsx`
- `src/components/fechamento/ExpensesSection.tsx`
- `src/components/fechamento/CalculationPanel.tsx`
- `src/components/artists/FinancialConfigTab.tsx`
- `src/lib/closingCalc.ts` (lógica pura de cálculo, com testes)
- `src/lib/closingPdf.ts`

**Editados:**
- `src/App.tsx` (rotas)
- `src/components/AppLayout.tsx` (menu + prefetch)
- `src/pages/Artistas.tsx` (nova aba)
