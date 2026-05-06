## Melhorias no módulo de Despesas (Financeiro da Produtora)

### 1. Migration do banco
Adicionar colunas em `producer_expenses` (todas com `IF NOT EXISTS`):
- `subcategoria`, `tipo_despesa` (default `custo_operacional`), `artist_id` (FK→artists), `projeto`, `centro_custo`
- Parcelamento: `parcelado`, `total_parcelas`, `numero_parcela`, `parcela_grupo_id`
- Bancários: `banco`, `agencia`, `conta`, `tipo_conta`, `chave_pix`, `tipo_chave_pix`
- Equipe: `departamento`, `tipo_contrato`, `cpf_cnpj`
- `tags`

Dados existentes preservados (ADD IF NOT EXISTS).

### 2. Catálogo de categorias (`src/lib/expenseCategories.ts` — novo)
Exporta estrutura hierárquica com 9 categorias × subcategorias, ícones e cores (semantic tokens). Helpers `getSubcategorias(cat)`, `getCategoriaMeta(cat)`.

### 3. ExpenseDialog — reescrita completa
`src/components/financeiro-produtora/ExpenseDialog.tsx`:
- Categoria + Subcategoria (dropdowns hierárquicos encadeados)
- Descrição, Valor (CurrencyInput), Vencimento, Responsável
- Bloco **Parcelamento** (toggle): nº parcelas (1–60), valor/parcela calculado e editável, data 1ª parcela
- Bloco **Classificação**: tipo_despesa, artista vinculado, projeto, centro_custo
- Bloco **Pagamento**: forma; se PIX/Transferência → banco, agência, conta, tipo_conta, tipo_chave_pix, chave_pix
- Bloco **Equipe** (visível quando categoria=`equipe`): nome/razão, CPF/CNPJ, departamento, tipo_contrato + dados bancários acima; checkbox "Salvar como beneficiário fixo" → insere em `fornecedores`
- Observações, tags
- **Submit**: se parcelado → gerar N inserts com `parcela_grupo_id` (uuid), `numero_parcela`, `total_parcelas`, datas mensais a partir da 1ª, cada uma com `mes_referencia` correto
- Upload de comprovante reaproveita o que já existe (se aplicável; caso contrário, deixar campo de upload simples no path `financeiro-produtora`)

### 4. RecurringExpenseDialog
Atualizar para incluir categoria/subcategoria nova (sem parcelamento — recorrente já é mensal).

### 5. Lista de despesas (página `FinanceiroProdutora.tsx`)
- Badge de categoria com ícone+cor
- Badge de tipo_despesa
- Coluna "Parcela" mostrando `numero_parcela/total_parcelas` quando parcelado
- Ao excluir uma parcela: detectar `parcela_grupo_id`; se houver, perguntar "Excluir todas as N parcelas?" e deletar em lote

### 6. Manter
- Sem alterar fluxo financeiro existente (cards do dashboard, fechamentos)
- Sem alterar `producer_recurring_expenses` schema

### Detalhes técnicos
- Tipos atualizados em `src/lib/producerFinance.ts` (manter `EXPENSE_CATEGORIES` legado para compat retroativa, mas novo arquivo `expenseCategories.ts` é a fonte de verdade)
- Cores via classes tailwind semantic (`bg-muted`, `bg-primary/10`, etc.) — mapeadas por categoria
- `parcela_grupo_id` gerado client-side com `crypto.randomUUID()`
