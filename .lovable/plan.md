
# Perfil Financeiro, travas e fluxo de pagamento do sinal

Esta entrega adiciona um novo perfil, três travas de negócio e um fluxo completo de status do show com prazo de 48h úteis, comprovante e cancelamento automático. Tudo permanece configurável (limites, prazos, mínimos) para o piloto.

## 1. Novo perfil: Financeiro

Permissões:

| Ação | Financeiro |
|---|---|
| Ver financeiro de todos os artistas/shows | ✅ |
| Ver e baixar comprovantes | ✅ |
| Confirmar pagamento de sinal (dar baixa) | ✅ |
| Criar/editar/excluir minuta | ❌ |
| Aprovar/rejeitar minuta | ❌ |
| Dashboard financeiro completo | ✅ |

- Adicionar valor `financeiro` ao enum `app_role`.
- Atualizar `AppRole` no `AuthContext`, `AppLayout` (sidebar mostra Dashboard, Shows somente leitura, Financeiro, Relatórios), `ProtectedRoute` e edge functions (`shows-admin`, `notifications`, `users-admin`).
- `Usuarios.tsx` passa a permitir atribuir o papel "Financeiro".

## 2. Trava 1 — Limite de 3 shows por dia por artista

- Nova tabela `app_settings` (chave/valor JSON) para guardar limites configuráveis. Seed inicial:
  - `max_shows_per_artist_per_day = 3`
  - `prazo_comprovante_horas_uteis = 48`
  - `aviso_antes_cancelamento_horas_uteis = 12`
- Validação na edge function `shows-admin` (action `create`):
  - Conta shows existentes do `artist_id` na `data_show` com `status != 'cancelada'`.
  - Se `>= max_shows_per_artist_per_day`, retorna 409 com a mensagem exata pedida.
- Mesma validação no frontend (mensagem amigável antes do submit).

## 3. Trava 2 — Cachê mínimo por artista

- Nova coluna `artists.cache_minimo numeric default 0`.
- UI em `Artistas.tsx` (apenas gerente) para editar o valor.
- Validação em `shows-admin`:
  - **Create**: se `cache_total < cache_minimo` e o usuário **não é gerente**, bloqueia com a mensagem pedida.
  - **Update**: se a minuta já está aprovada e o novo `cache_total < cache_minimo`, só gerente pode salvar.
- Frontend mostra o mínimo no formulário e replica a checagem.

## 4. Trava 3 — Fluxo de status do show

### 4.1 Enum `show_status` (substitui o atual)

Valores finais: `pendente`, `aguardando_pagamento`, `comprovante_enviado`, `confirmado`, `cancelada`.

### 4.2 Novas colunas em `shows`

- `prazo_comprovante_em timestamptz` — calculado na aprovação (now + 48h úteis).
- `aviso_12h_enviado_em timestamptz` — controle de envio do aviso.
- `comprovante_url text` — caminho no Storage (bucket privado `comprovantes`).
- `comprovante_enviado_em timestamptz`.
- `comprovante_enviado_por uuid`.
- `confirmado_por uuid`, `confirmado_em timestamptz`.
- `cancelado_em timestamptz`, `cancelado_motivo text`.

### 4.3 Storage

- Bucket privado `comprovantes` com RLS:
  - Vendedor que criou o show pode `INSERT` apenas em `comprovantes/{show_id}/...`.
  - Gerente, equipe, financeiro e o vendedor criador podem `SELECT` (download via URL assinada).

### 4.4 Edge function `shows-admin` — novas actions

- `approve` (gerente): set status `aguardando_pagamento`, calcula `prazo_comprovante_em` usando função SQL `add_business_hours(now(), 48)` (considera só seg-sex), notifica vendedor.
- `upload_comprovante` (vendedor criador, gerente, equipe): recebe `path`, atualiza `comprovante_url`, status → `comprovante_enviado`, notifica financeiro + gerência.
- `confirm_payment` (financeiro ou gerente): status → `confirmado`, grava `confirmado_por/em`, notifica vendedor. (Atualização do Google Calendar fica como TODO marcado, fora desta etapa.)
- `cancel_for_no_proof` (interno, chamado pelo cron): status → `cancelada`, notifica vendedor/gerência/financeiro.

### 4.5 Job agendado (pg_cron + pg_net)

Nova edge function `shows-deadline-check` rodando a cada 15 min:

1. Busca shows `status = 'aguardando_pagamento'`.
2. Para cada um:
   - Se faltam ≤ 12h úteis e `aviso_12h_enviado_em IS NULL` → cria notificação de aviso para vendedor + gerência + financeiro, marca o campo.
   - Se `prazo_comprovante_em <= now()` → chama `cancel_for_no_proof` (status `cancelada`, notificações).
3. Cron criado via tool `supabase--insert` (não migration, pois usa anon key específica do projeto).

### 4.6 Cores e badges

Mapa central em `src/lib/showStatus.ts`:

```text
pendente              → cinza   "Pendente"
aguardando_pagamento  → amarelo "Aguardando Pagamento"
comprovante_enviado   → laranja "Comprovante Enviado — Aguardando Confirmação"
confirmado            → verde   "CONFIRMADO"
cancelada             → vermelho "CANCELADO"
```

Aplicar nos cards de `Shows.tsx`, `Dashboard.tsx`, `Agenda.tsx`.

## 5. RLS atualizada (resumo)

- `shows` SELECT: gerente/equipe/financeiro veem tudo; vendedor vê suas próprias + aprovadas/confirmadas dos outros (mesma regra atual de campos públicos via API); artista vê apenas do seu `artist_id`.
- `shows` UPDATE: apenas gerente e equipe (financeiro NÃO edita minuta — só baixa pagamento via edge function com service role).
- `notifications`: regra atual mantida; financeiro recebe via inserts da edge.
- `app_settings`: SELECT autenticado, UPDATE apenas gerente.
- `artists.cache_minimo`: já coberto pela policy "Gerente gerencia artistas".

## 6. Frontend

### 6.1 `Shows.tsx`
- Badge colorido por status conforme mapa acima.
- Cards `aguardando_pagamento` mostram contador "Restam Xh úteis" e botão **Anexar comprovante** (vendedor criador / gerente / equipe).
- Cards `comprovante_enviado` mostram botão **Ver comprovante** + **Confirmar pagamento** (financeiro / gerente).
- Filtros por status novos.

### 6.2 `Dashboard.tsx`
- Card específico para Financeiro: total a receber, recebido, comprovantes pendentes de baixa, shows cancelados no mês.
- Para gerência: contadores de cada status.

### 6.3 `Artistas.tsx`
- Campo "Cachê mínimo (R$)" no formulário (gerente).

### 6.4 `Usuarios.tsx`
- Opção "Financeiro" no seletor de papel.

### 6.5 Notificações
- Já temos `NotificationBell`. Adicionar novos `tipo`s: `prazo_12h`, `comprovante_enviado`, `pagamento_confirmado`, `show_cancelado`.

## 7. Fora desta entrega

- Sincronização real Google Calendar (apenas marcamos TODO no `confirm_payment` e `cancel_for_no_proof`).
- E-mail externo das notificações (continua só in-app).
- Tela de configurações de `app_settings` na UI — por ora, valores ficam editáveis via banco (gerente). Posso adicionar uma tela "Configurações" depois se quiser.

---

Se aprovar, sigo na ordem: migração → edge functions → frontend → cron. Avise se quer mudar algo (ex.: incluir já a tela de Configurações, ou tratar dias úteis como corridos).
