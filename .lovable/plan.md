
# Redesenho de perfis de acesso e fluxo de aprovação de minutas

Esta entrega reorganiza permissões, ajusta o fluxo de minutas (pendente → aprovada/rejeitada) e adiciona notificações no app. Google Calendar fica fora desta etapa, conforme decidido. Tudo permanece editável para ajustes futuros do piloto.

## 1. Perfis e permissões (estado final)

| Ação | Vendedor | Artista | Gerência |
|---|---|---|---|
| Criar minuta | ✅ | ❌ | ✅ |
| Editar minuta | ❌ | ❌ | ✅ |
| Excluir minuta | ❌ | ❌ | ✅ |
| Aprovar/rejeitar minuta | ❌ | ❌ | ✅ |
| Ver minutas próprias (todos os campos) | ✅ | — | ✅ |
| Ver minutas de outros vendedores | Apenas **local + horário**, e só de **aprovadas** | — | Tudo |
| Ver shows do próprio artista (minuta completa) | — | ✅ | ✅ |
| Ver financeiro do próprio artista | — | ✅ | ✅ (todos) |
| Dashboard | Próprias vendas + status | Financeiro próprio | Visão geral total |

## 2. Banco de dados

Nova migração com:

- Coluna `shows.status` (enum `show_status`: `pendente`, `aprovada`) — default `pendente`. Rejeitada = registro excluído (conforme escolha), portanto não precisa de valor próprio. Mantemos o enum extensível.
- Colunas `shows.aprovado_por` (uuid), `shows.aprovado_em` (timestamptz), `shows.created_by_role` (text, opcional para auditoria).
- Nova tabela `notifications`:
  - `id`, `user_id`, `tipo` (`minuta_aprovada` | `minuta_rejeitada`), `titulo`, `mensagem`, `show_id` (nullable), `lida` (bool default false), `created_at`.
  - RLS: usuário vê e marca como lida apenas as próprias; gerente pode inserir para qualquer um (via service role na edge function).
- Reescrita das policies da tabela `shows`:
  - **SELECT**: gerente/equipe veem tudo; artista vê apenas shows do seu `artist_id`; vendedor vê integralmente as minutas que ele criou (`created_by = auth.uid()`) e — para as demais — apenas linhas com `status = 'aprovada'` (a restrição de campos é feita via uma **view pública** `shows_public_view` exposta para vendedores, com somente `id`, `data_show`, `horario`, `local`, `cidade`).
  - **INSERT**: gerente, equipe, vendedor (com `created_by = auth.uid()`).
  - **UPDATE**: apenas gerente e equipe.
  - **DELETE**: apenas gerente.
- Manter o enum `app_role` atual (`gerente`, `equipe`, `artista`, `vendedor`) — sem mudanças.

## 3. Edge function `shows-admin`

- `action: "list"` agora retorna estrutura diferente conforme papel:
  - **Gerente/equipe**: tudo + status + dados do criador.
  - **Vendedor**: 2 listas → `minhas` (completas, com status) e `outras_aprovadas` (apenas `data_show`, `horario`, `local`, `cidade`, `artist_nome`).
  - **Artista**: somente shows do seu artista (completos).
- `action: "create"`: força `status = 'pendente'` e `created_by = auth.uid()`.
- `action: "update"`: bloqueado para vendedor (já está); aceita campos da minuta.
- `action: "approve"` (novo): apenas gerente. Define `status='aprovada'`, `aprovado_por`, `aprovado_em` e cria `notification` para o `created_by` ("Sua minuta foi aprovada").
- `action: "reject"` (novo): apenas gerente. Recebe `motivo` (string). Cria notificação `minuta_rejeitada` com o motivo para o `created_by`. Em seguida **exclui** o registro do show (conforme decisão). Tudo em transação.
- `action: "delete"`: continua só gerente.

## 4. Nova edge function `notifications`

- `list`: retorna notificações do usuário logado, ordenadas por `created_at desc`.
- `mark_read`: marca uma ou todas como lidas.
- `unread_count`: contagem rápida para o badge do sino.

## 5. Frontend

### 5.1 Sidebar / `AppLayout`
- Itens visíveis por papel revisados:
  - Vendedor: Dashboard, Shows.
  - Artista: Dashboard, Shows (somente leitura), Agenda, Financeiro.
  - Gerência: tudo.
- Adicionar **ícone de sino** no topo (desktop e mobile) com badge de não lidas → abre painel `Notificações`.

### 5.2 Página `Shows.tsx`
- Cards de minuta passam a mostrar **badge de status** (Pendente / Aprovada).
- Para gerência, cada minuta pendente ganha botões **Aprovar** e **Rejeitar** (modal com campo "motivo" obrigatório na rejeição).
- Para vendedor:
  - Seção "Minhas minutas" (completas, com status).
  - Seção "Shows aprovados (outros vendedores)" — somente `data, horário, local, cidade, artista`. Sem botões.
- Para artista: cards somente leitura, sem botões.
- Botão "Editar" some para vendedor (já está) e para artista. "Excluir" continua só gerente.

### 5.3 Dashboard (`Dashboard.tsx`)
Renderização condicional por papel:
- **Vendedor**: cards "Minhas minutas", "Pendentes", "Aprovadas", "Rejeitadas (últimos 30 dias — via notificação)" + lista das últimas minutas com status.
- **Artista**: cards financeiros do próprio artista (cachê total confirmado, recebido, a receber, despesas) + próximos shows. Reaproveita `show_deposits` e `show_expenses`.
- **Gerência**: visão atual (geral) + "Minutas pendentes de aprovação" como destaque.

### 5.4 Notificações in-app
- Novo componente `NotificationBell` no `AppLayout`.
- Novo componente `NotificationsPanel` (Popover) com lista, "marcar todas como lidas" e link para a minuta (quando aprovada).
- Polling leve a cada 30s via `useQuery` para o `unread_count` (sem websockets nesta fase, mantém simples).

### 5.5 `AuthContext`
- Já contempla `vendedor` no enum implicitamente (string), mas vamos tipar oficialmente:
  ```ts
  export type AppRole = "gerente" | "equipe" | "artista" | "vendedor";
  ```

## 6. Fluxo final da minuta

```text
Vendedor cria  ──► status: pendente
                    │
                    ├─► Gerência aprova ──► status: aprovada
                    │                       └─► Notificação "aprovada" → vendedor
                    │
                    └─► Gerência rejeita ──► Notificação "rejeitada (+motivo)" → vendedor
                                              └─► Registro excluído
```

Google Calendar: nenhuma chamada nesta etapa. A coluna `data_subida` e o restante do formulário continuam iguais.

## 7. Itens fora desta entrega (registrados para depois)

- Sincronização real com Google Calendar (criar/atualizar/remover eventos por status).
- E-mail de notificação (hoje só in-app).
- Tela de gestão de usuários para atribuir o papel `vendedor` (continua sendo feito pelo gerente direto no banco até existir a UI).

---

Posso seguir com a implementação assim que aprovar. Se quiser mudar algo (ex.: manter rejeitadas em vez de excluir, ou adicionar reenvio), me avise antes que ajusto o plano.
