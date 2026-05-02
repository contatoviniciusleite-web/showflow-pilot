## Resumo

Implementar 5 alterações no ShowFlow envolvendo o perfil **Financeiro**, fluxo de pagamentos, múltiplos comprovantes e nova aba de Anexos na ficha do show.

---

## Alteração 1 — Agenda para Financeiro

- A página `/agenda` hoje mostra `VendedorAgenda` (calendário de artistas liberados ao vendedor).
- Criar uma visão de calendário **completa para Financeiro** (todos artistas, todos shows, sem filtro de propriedade).
- No calendário e na lista do dia, exibir **status financeiro**: Aguardando Pagamento (amarelo), Comprovante Enviado (laranja), Confirmado (verde), Atrasado (vermelho — quando `prazo_comprovante_em` passou e ainda não confirmado).
- Clicar no show abre a **ficha financeira completa** (modal/drawer) com pagamentos, comprovantes e ações.
- RLS de `shows`: adicionar leitura para `financeiro` de todos os shows (hoje só vê via subqueries em depósitos/despesas; precisa SELECT direto).

## Alteração 2 — Baixa manual de pagamento

- Criar tabela `show_payments` para registrar baixas (manuais ou via comprovante):
  - `valor`, `data_pagamento`, `forma_pagamento` (enum: pix/transferencia/especie/outro), `conta_destino`, `observacoes`, `comprovante_id` (FK opcional para `show_attachments`), `registrado_por`, `created_at`.
- RLS: somente **Financeiro** pode INSERT/UPDATE/DELETE. SELECT para gerência, equipe, financeiro e vendedor criador do show.
- UI: na ficha do show, aba **Financeiro**, botão "Registrar Pagamento Manual" (visível só para Financeiro). Modal com campos do briefing. Observação obrigatória se não houver comprovante anexado.

## Alteração 3 — Confirmação exclusiva do Financeiro

- Hoje o status `confirmado` é setado por gerente/equipe. Alterar regra:
  - Endpoint `confirmar_pagamento` no `shows-admin` passa a aceitar **apenas role `financeiro`**.
  - Remover botão "Confirmar pagamento" da UI quando o usuário for gerente/equipe (sem o papel financeiro).
- Ao confirmar, registrar `confirmado_por` (uuid) + `confirmado_em` (já existem). Adicionar campo `confirmado_por_nome` (text) para snapshot do nome.
- Visibilidade do "Confirmado por [nome] em [data/hora]":
  - Gerência ✅ / Vendedor ✅ / Artista ❌
- Notificações ao confirmar:
  - Vendedor (criador do show) recebe `pagamento_confirmado`
  - Todos os usuários com role `gerente` recebem a mesma notificação
  - Adicionar `pagamento_confirmado` à constraint `notifications_tipo_check`

## Alteração 4 — Múltiplos comprovantes

- Hoje `shows.comprovante_url` é único. Migrar para tabela `show_attachments`:
  - `id`, `show_id`, `tipo` (enum: comprovante / documento), `file_path`, `file_name`, `mime_type`, `size_bytes`, `uploaded_by`, `uploaded_by_nome`, `created_at`.
- Botão "Anexar comprovante" continua sempre disponível na ficha (vendedor criador do show + financeiro + gerência).
- Cada anexo é registrado individualmente; nada substitui o anterior. Manter `shows.comprovante_url` por compatibilidade temporária (opcional).
- Storage: continuar usando bucket `comprovantes` (já privado, 10MB, MIME PDF/JPG/PNG).
- Nome do arquivo no bucket: `{show_id}/{timestamp}-{slug}.{ext}` (mantém política RLS atual baseada no primeiro segmento do path).

## Alteração 5 — Aba "Anexos" na ficha do show

- Reorganizar a ficha do show em **abas**: Geral / Financeiro / Anexos / Histórico (já existem algumas seções; consolidar em `Tabs`).
- Aba **Anexos**:
  - Lista cronológica (desc) de todos os itens em `show_attachments`.
  - Cada item: ícone (PDF/imagem), nome do arquivo, quem anexou, data/hora, botões Ver, Baixar, Excluir.
  - Acessos:
    - Financeiro / Gerência: ver, baixar, excluir todos.
    - Vendedor: ver e baixar **apenas os anexos enviados por ele**.
    - Artista: aba não aparece.
- "Ver" e "Baixar" usam `createSignedUrl` (bucket privado).
- "Excluir" remove o registro + o arquivo do storage (apenas Financeiro/Gerência).

---

## Detalhes técnicos

### Migrações

1. **`show_payments`** (nova tabela + RLS).
2. **`show_attachments`** (nova tabela + RLS + helper `can_view_attachment(_user_id, _attachment_id)`).
3. **`shows`**: adicionar `confirmado_por_nome text`.
4. **RLS `shows`**: trocar policy SELECT para incluir `financeiro` em todos os shows (hoje já inclui, manter).
5. **RLS `notifications`**: estender `notifications_tipo_check` com `pagamento_confirmado`.
6. **Storage policies do bucket `comprovantes`**: ajustar DELETE para Financeiro também (hoje só "manage").

### Edge function `shows-admin`

- Novas actions:
  - `register_payment` — só financeiro; insere em `show_payments`; opcional `attachment_id`.
  - `confirm_payment` — só financeiro; seta status `confirmado`, `confirmado_por`, `confirmado_por_nome`, `confirmado_em`; cria notificações para criador + gerentes.
  - `add_attachment` — registra metadados em `show_attachments` após upload no storage.
  - `list_attachments` — devolve lista filtrada conforme papel.
  - `delete_attachment` — só financeiro/gerência; remove do storage e da tabela.
  - `list_payments` — para a ficha financeira.
- Ajustar `list` para incluir `confirmado_por_nome`, lista de pagamentos e contagem de anexos por show (ou carregar sob demanda).
- Action `agenda_financeiro` (ou reusar `list` com flag) — devolve **todos** os shows quando o caller tiver role `financeiro`.

### Frontend

- **`src/pages/Agenda.tsx`**: detectar role financeiro e renderizar novo `<FinanceiroAgenda />` no lugar de `VendedorAgenda`.
- **Novo `src/components/dashboard/FinanceiroAgenda.tsx`**: calendário com todos os shows, badge de status financeiro, dia clicado abre lista; clicar num show abre ficha completa.
- **`src/pages/Shows.tsx`**: refatorar o modal/drawer da ficha do show para usar `Tabs` (Geral, Financeiro, Anexos, Histórico). Esconder botão "Confirmar pagamento" para não-financeiro. Adicionar "Registrar Pagamento Manual" para financeiro.
- **Novo `src/components/shows/AttachmentsTab.tsx`**: lista + upload + ações.
- **Novo `src/components/shows/PaymentsTab.tsx`** (ou seção): lista de pagamentos + botão de baixa manual + botão "Confirmar pagamento" (só financeiro).
- Exibir "Confirmado por [nome] em [data/hora]" para gerência e vendedor; ocultar para artista.

### Permissões / configuráveis

- Centralizar checks em `src/lib/permissions.ts` (novo) com funções como `canRegisterPayment(roles)`, `canConfirmPayment(roles)`, `canDeleteAttachment(roles)`, `canViewConfirmedBy(roles)` — para facilitar ajustes futuros do piloto.

---

## Ordem de execução

1. Migração 1: `show_attachments` + `show_payments` + `confirmado_por_nome` + constraint notifications + storage policies.
2. Atualizar `shows-admin` com as novas actions.
3. Criar `src/lib/permissions.ts`.
4. Criar `FinanceiroAgenda` + ajustar `Agenda.tsx`.
5. Refatorar ficha do show em `Shows.tsx` com Tabs + componentes Anexos/Pagamentos.
6. Ajustar notificações e exibição de "Confirmado por".
