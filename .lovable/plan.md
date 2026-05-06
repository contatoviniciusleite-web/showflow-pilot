# Módulo de Ordens de Pagamento

Cria um sistema completo de Ordens de Pagamento vinculado ao Fechamento Semanal, incluindo cadastro de fornecedores, geração automática ao finalizar fechamento, página de gestão para o Financeiro e alertas no dashboard.

## 1. Banco de dados (migration única)

### Tabela `fornecedores`
- `nome` (text, obrigatório)
- `tipo` (text: Van / Equipamento / Efeitos / Outros)
- `telefone`, `chave_pix`, `banco`, `agencia`, `conta`, `observacoes` (nullable)
- `ativo` (boolean default true)
- Padrão: id, created_at, updated_at

**RLS:** SELECT autenticados; ALL para Diretor/Financeiro.

### Tabela `payment_orders`
- `closing_id` FK → `weekly_closings` (ON DELETE CASCADE)
- `artist_id` FK → `artists`
- `tipo` (text: artista / socio / equipe / vendedor / despesa / clipe / investimento)
- `beneficiario_nome` (text)
- `beneficiario_id` (uuid nullable — referência a `profiles.id` quando aplicável)
- `descricao` (text)
- `valor` (numeric 15,2)
- `data_sugerida` (date — quarta-feira da semana seguinte ao fechamento)
- `data_pagamento` (date nullable)
- `status` (text default 'pendente': pendente / agendado / pago / cancelado)
- `forma_pagamento` (text nullable)
- `valor_pago` (numeric 15,2 nullable)
- `comprovante_path` (text nullable)
- `pago_por` (uuid nullable), `pago_em` (timestamptz nullable)
- `motivo_cancelamento` (text nullable)
- `observacoes` (text nullable)
- Padrão: id, created_at, updated_at

**RLS:** 
- SELECT: Diretor + Financeiro; também o próprio beneficiário (`beneficiario_id = auth.uid()`) quando ordem está paga.
- INSERT/UPDATE/DELETE: apenas Financeiro.

### Coluna em `weekly_closing_expenses`
Adicionar `fornecedor_id` (uuid nullable) — vínculo opcional com fornecedor cadastrado.

### Storage
Bucket `comprovantes-pagamentos` (privado) para anexos de comprovante. Policies: Financeiro INSERT/SELECT/DELETE; Diretor SELECT.

### Trigger `update_payment_orders_updated_at`
Reusa `set_updated_at`.

## 2. Cadastro de Fornecedores

**Página `/fornecedores`** (`src/pages/Fornecedores.tsx`) — visível para Diretor/Financeiro.
- Tabela com filtro por tipo + busca
- Dialog CRUD (`FornecedorDialog.tsx`) com todos os campos
- Toggle Ativo/Inativo

**Menu lateral** (`AppLayout.tsx`): item "Fornecedores" com ícone `Building2`, roles `["diretor", "financeiro"]`.

**Integração na tabela C** (Despesas em `FechamentoDetalhe.tsx`):
- Quando `responsavel = "produtora"`, mostrar dropdown adicional "Fornecedor" filtrado pelo tipo da despesa (categoria → tipo do fornecedor).
- Persistir em `weekly_closing_expenses.fornecedor_id`.

## 3. Geração automática das ordens

**Lib `src/lib/paymentOrders.ts`**: função `generatePaymentOrdersForClosing(closingId)`:
1. Carrega closing + shows + crew + expenses + clipe + investments + distribution + config + partners + fornecedores.
2. Calcula `data_sugerida` = próxima quarta-feira após `semana_fim` (usando `date-fns`).
3. Monta lista de ordens conforme regras:
   - **Artista**: 1 ordem com valor da distribuição tipo `artista`.
   - **Sócios**: 1 por sócio ativo, valor = `valor_bruto` da distribuição, descrição inclui `(-) Investimento: ...` quando `investimento_valor > 0`. Valor final = `valor_bruto - investimento_valor`.
   - **Equipe**: 1 por membro com `total_receber > 0`.
   - **Vendedores**: agrupar shows por `vendedor` e somar `comissao_vendedor`.
   - **Despesas**: 1 por despesa com `responsavel = produtora` e `incluir_no_calculo = true`. Beneficiário = nome do fornecedor (se vinculado) ou descrição.
   - **Clipe**: 1 por profissional com `quantidade × valor_por_clipe`.
4. Estratégia de upsert:
   - **Primeira finalização**: insere todas.
   - **Reabertura/edição**: só atualiza ordens com status `pendente`/`agendado`. As `pago`/`cancelado` permanecem; coletar contagem de `pago` para retornar como aviso.
   - Estratégia: deletar pendentes/agendadas existentes do closing, reinserir nova lista (excluindo as já pagas/canceladas para evitar duplicar; matchar por `tipo + beneficiario_nome + descricao` é frágil — manter uma chave estável `chave_origem` opcional? Para piloto: deletar pendentes/agendadas e reinserir.)

**Hook no fluxo de finalizar** em `FechamentoDetalhe.tsx` (`handleFinalize`): após persistir distribution, chamar `generatePaymentOrdersForClosing` e exibir toast com aviso se houver ordens já pagas.

## 4. Página /pagamentos

**`src/pages/Pagamentos.tsx`** — Financeiro full / Diretor read-only.

### Filtros (topo)
- Artista (dropdown)
- Período (date range — filtra `data_sugerida`)
- Status (Todos/Pendente/Agendado/Pago/Cancelado)
- Tipo (Todos/Artista/Sócio/Equipe/Vendedor/Despesa/Clipe)

### Cards de resumo
- Total a pagar (pendente+agendado)
- Total pago
- Qtd ordens pendentes
- Qtd ordens pagas

### Listagem agrupada por fechamento
Cada grupo: header com artista + período + totais; tabela interna com linhas das ordens (checkbox, tipo badge colorido, beneficiário, valor, data sugerida, status badge, ações).

### Badges
- Tipo: artista verde-escuro, socio roxo, equipe azul, vendedor laranja, despesa cinza, clipe rosa.
- Status: pendente amarelo, agendado azul-claro, pago verde ✅, cancelado vermelho.

### Ações por linha (Financeiro)
- **Agendar** (`SchedulePaymentDialog`): data + obs → status `agendado`.
- **Marcar como pago** (`MarkAsPaidDialog`): valor_pago, data, forma, upload comprovante (bucket `comprovantes-pagamentos`), obs → status `pago`, registra `pago_por`/`pago_em`. Cria notificação se `beneficiario_id` definido.
- **Cancelar** (`CancelPaymentDialog`): motivo → status `cancelado`.

### Ação em lote
Checkbox por linha + topbar com botão "Marcar selecionadas como pagas" (abre dialog único com data/forma; mantém valor original de cada).

## 5. Dashboard Financeiro

Em `src/components/dashboard/FinanceiroAgenda.tsx` (ou novo bloco no Dashboard p/ role financeiro):
- **Card "Pagamentos desta semana"**: ordens com `data_pagamento` (ou `data_sugerida` se não agendado) na semana atual, status ≠ pago/cancelado. Soma + qtd + link `/pagamentos?semana=atual`.
- **Card "Pagamentos atrasados"** (vermelho): ordens com `data_pagamento < hoje` e status ≠ pago/cancelado.

## 6. Notificações

Quando ordem marcada como paga e `beneficiario_id IS NOT NULL`:
- Inserir em `notifications` (user_id = beneficiario_id, tipo = `pagamento_confirmado`, título "Pagamento confirmado", mensagem "Seu pagamento de R$ X foi confirmado: [descrição]").

Mapear `beneficiario_id` na geração das ordens:
- Artista: pegar `user_roles` com role `artista` e `artist_id` correspondente (primeiro encontrado).
- Vendedor: lookup por nome em `profiles.nome` (best-effort; nullable).
- Outros: nullable.

## 7. Permissões

Em `src/lib/permissions.ts` adicionar:
- `canManagePaymentOrders(roles)` → financeiro
- `canViewPaymentOrders(roles)` → diretor || financeiro
- `canManageFornecedores(roles)` → diretor || financeiro

## 8. Roteamento

`src/App.tsx`: rotas lazy `/pagamentos` e `/fornecedores` com `ProtectedRoute`.
`src/components/AppLayout.tsx`: itens no menu entre Fechamentos e Relatórios (Pagamentos) e dentro do bloco gestão (Fornecedores).

## Arquivos

**Novos:**
- `supabase/migrations/<ts>_payment_orders.sql`
- `src/pages/Fornecedores.tsx`
- `src/pages/Pagamentos.tsx`
- `src/components/fornecedores/FornecedorDialog.tsx`
- `src/components/pagamentos/SchedulePaymentDialog.tsx`
- `src/components/pagamentos/MarkAsPaidDialog.tsx`
- `src/components/pagamentos/CancelPaymentDialog.tsx`
- `src/components/pagamentos/BulkPayDialog.tsx`
- `src/components/pagamentos/PaymentOrdersGroup.tsx`
- `src/lib/paymentOrders.ts`

**Editados:**
- `src/App.tsx`
- `src/components/AppLayout.tsx`
- `src/lib/permissions.ts`
- `src/pages/FechamentoDetalhe.tsx` (dropdown fornecedor + chamada de geração no finalizar)
- `src/pages/Dashboard.tsx` ou `src/components/dashboard/FinanceiroAgenda.tsx` (cards de alerta)
