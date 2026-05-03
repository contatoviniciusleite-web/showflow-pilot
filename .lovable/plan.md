# Reestruturação da Minuta em 4 Etapas

Substituir o fluxo atual da minuta por um modelo em 4 etapas, com aprovação prévia da gerência sobre dados mínimos e dados completos só após aprovação.

## Resumo do Novo Fluxo

```
[Vendedor]              [Gerência]              [Vendedor + Contratante]      [Sistema]
   |                        |                            |                        |
1. Cria minuta básica  →  2. Aprova/Rejeita  →  3. Completa dados  →  4. Minuta completa
   (5 campos)              (vê só os 5)         (manual ou via link)    (48h úteis para sinal)
   status: pendente        aprovada/rejeitada   aguardando_dados →      aguardando_pagamento
                                                aguardando_contratante  → comprovante → confirmado
```

## Novos Status

| Status (enum) | Label | Cor |
|---|---|---|
| `pendente` | Pendente | cinza |
| `rejeitada` | Rejeitada | vermelho |
| `aguardando_dados` | Aguardando Dados | azul |
| `aguardando_contratante` | Aguardando Contratante | azul claro |
| `aguardando_pagamento` | Aguardando Pagamento | amarelo |
| `comprovante_enviado` | Comprovante Enviado | laranja |
| `confirmado` | Confirmado | verde |
| `cancelada` | Cancelado | vermelho escuro |
| `remarcada` | Remarcado | roxo |

Adicionar valores novos ao enum `show_status`: `rejeitada`, `aguardando_dados`, `remarcada`. Manter `aprovada` como legado para compatibilidade.

## Etapa 1 — Vendedor cria minuta básica

Formulário simplificado com apenas:
- Artista (select)
- Cachê total (R$)
- Cidade
- Local
- Data + horário

Validações mantidas: cachê mínimo do artista e limite de 3 shows/dia/artista. Status inicial: `pendente`. Campos extras ficam ocultos para o vendedor nesta etapa.

## Etapa 2 — Gerência aprova/rejeita

Modal de detalhes mostra apenas os 5 campos. Botões:
- **Aprovar** → status `aguardando_dados`, notifica vendedor: "Sua minuta [artista] em [local] dia [data] foi aprovada! Complete os dados para prosseguir."
- **Rejeitar** (com motivo) → status `rejeitada`, notifica vendedor com o motivo.

Gerência sempre pode editar tudo, em qualquer etapa.

## Etapa 3 — Vendedor completa os dados

Quando status = `aguardando_dados`, o card do vendedor mostra botão "Completar dados" com duas opções:

**Opção A — Link público** (já existe via `contratante-link`):
- Reaproveitar fluxo de geração de link (24h)
- Quando contratante preenche, status volta para `aguardando_dados` (não direto para `aguardando_pagamento`) — vendedor revisa e clica "Finalizar dados" para então preencher condições de pagamento, rider, transporte, cláusulas etc., e travar.
- Enquanto link ativo e não preenchido: status `aguardando_contratante`.

**Opção B — Preenchimento manual**:
- Vendedor abre form expandido com todas as seções (contratante, pagamento, hospitalidade, transporte, cláusulas, encargos, data subida, autorizado por).

Ao concluir Etapa 3 (qualquer opção):
- Status → `aguardando_pagamento`
- `prazo_comprovante_em` é setado agora (48h úteis via `add_business_hours_br`)
- Notificação para gerência + financeiro: "Minuta [artista]/[local]/[data] com dados completos. Aguardando comprovante do sinal."

## Etapa 4 — Visibilidade por papel

Implementar no edge `shows-admin` (lista) e em `ShowDetailsModal`:

| Papel | Vê |
|---|---|
| Gerência | Tudo + histórico |
| Financeiro | Tudo + dados do contratante |
| Vendedor (dono) | 5 básicos + contratante + financeiro/comprovantes |
| Vendedor (outros) | Artista, Local, Cidade, Horário (sem cachê/contratante/financeiro) |
| Artista | Data, Horário, Local, Cidade |

A query `outras_aprovadas` já filtra; precisa garantir que campos sensíveis (cachê, contratante_*) NÃO sejam retornados para outros vendedores. Hoje retorna `cache_total` — remover.

## Mudanças técnicas

### Banco (migration)
- `ALTER TYPE show_status ADD VALUE 'rejeitada'`, `'aguardando_dados'`, `'remarcada'` (se não existirem).
- Coluna `rejeitada_motivo TEXT` e `rejeitada_em TIMESTAMPTZ` em `shows`.
- Coluna `dados_completos_em TIMESTAMPTZ` em `shows` (marca quando entra em `aguardando_pagamento`).
- Setting `app_settings.prazo_comprovante_horas` (já existe, manter padrão 48).

### Edge `shows-admin`
- Action `create` aceita só os 5 campos obrigatórios; demais opcionais.
- Action `approve` → status `aguardando_dados` (em vez de `aprovada`).
- Nova action `reject` (já existe) → status `rejeitada`.
- Nova action `complete_data` → recebe payload com dados do contratante e demais seções; valida; seta `prazo_comprovante_em = add_business_hours_br(now(), 48)`; status `aguardando_pagamento`; notifica gerência+financeiro.
- Action `submit_contratante_data` (do edge `contratante-link`) deixa status como `aguardando_dados` (não pula direto).
- Lista para outros vendedores: omitir `cache_total`, `contratante_*`, dados financeiros.

### Frontend
- `src/lib/showStatus.ts`: incluir `rejeitada`, `aguardando_dados`, `remarcada` com labels/cores acima.
- `src/pages/Shows.tsx`:
  - Form de criação: reduzir para 5 campos.
  - Card do vendedor com status `aguardando_dados`: botão "Completar dados" abre modal com tabs "Enviar link" / "Preencher manualmente".
  - Card de outros vendedores: ocultar cachê e contratante.
- `ShowDetailsModal`: tab "Dados completos" só aparece quando status >= `aguardando_pagamento` ou usuário é gerência/financeiro/dono.
- Notificações: ajustar mensagens nos handlers `approve`, `reject`, `complete_data`.

### Compatibilidade
- Shows existentes com status `aprovada` continuam exibidos como "Confirmado" legado (já mapeado).
- Campos antigos preenchidos no momento da criação (rider, transporte, etc.) ficam preservados; novo form ignora-os e a Etapa 3 permite editar.

## Arquivos afetados

- `supabase/migrations/<novo>.sql` (enum + colunas)
- `supabase/functions/shows-admin/index.ts`
- `supabase/functions/contratante-link/index.ts`
- `src/lib/showStatus.ts`
- `src/pages/Shows.tsx`
- `src/components/shows/ShowDetailsModal.tsx`
- `src/integrations/supabase/types.ts` (auto)

## Pontos a confirmar antes de implementar

1. Quando o **contratante preenche via link**, o status deve voltar para `aguardando_dados` (vendedor revisa e finaliza manualmente para então ir a `aguardando_pagamento`) ou ir direto para `aguardando_pagamento`?
2. Devemos **migrar shows existentes** com status `aprovada` para algum dos novos status, ou deixar como legado?
3. O status `remarcada` deve substituir o uso atual de `cancelada` + criação de novo show, ou apenas ser um label adicional usado quando `remarcado_count > 0`?
