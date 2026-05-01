# Vendedor: agenda do artista + permissões por artista

## Objetivo

- O Gerente define quais artistas cada Vendedor pode visualizar/vender.
- Vendedor passa a ter uma Agenda no dashboard, com calendário dos artistas liberados.
- Vendedor vê todos os shows ocupando a data; minutas dos outros vendedores aparecem só com **local + horário** (sem cachê, contratante, vendedor, etc.).
- Criar minuta direto do calendário, com artista pré-selecionado e respeitando o limite de 3 shows/dia.

## Mudanças no banco (migração)

Nova tabela `public.vendedor_artists`:

- `vendedor_id uuid` (auth.users.id)
- `artist_id uuid` (artists.id)
- `created_at timestamptz default now()`
- PK composta `(vendedor_id, artist_id)`

RLS:
- SELECT: o próprio vendedor vê suas permissões; gerente vê todas.
- ALL: somente gerente.

Atualizar a view `public.shows_public_view` para também expor:
- `tipo_estrutura` (continua sem cachê / contratante / vendedor — apenas data, horário, local, cidade).

A view permanece com `security_invoker = true` (RLS de `shows` controla a visibilidade), e ganha um filtro adicional para mostrar todos os status exceto `cancelada` (assim a agenda mostra dias ocupados também por shows pendentes/aprovados, não só os já confirmados).

## Backend (edge functions)

### `users-admin`

- Em `list`: incluir `vendedor_artist_ids: string[]` para cada usuário (consulta em `vendedor_artists`).
- Em `invite` e `set_roles`: aceitar parâmetro opcional `vendedor_artist_ids: string[]` e fazer replace completo das permissões em `vendedor_artists` quando o usuário tem papel `vendedor`. Se o usuário deixa de ser vendedor, limpa permissões.

### `shows-admin`

Em `action: list`, no ramo `isVendedor`:
- Buscar `allowedArtistIds` do vendedor em `vendedor_artists`.
- `minhas`: apenas onde `created_by = userId` E `artist_id` está em `allowedArtistIds`.
- `outras_aprovadas`: ler de `shows_public_view` filtrando por `artist_id in (allowedArtistIds)` e `created_by <> userId`.

Em `action: artists` (lista de artistas para criação): se o caller for **apenas** vendedor (sem gerente/equipe), filtrar pelos artistas liberados.

Em `action: create`: se for vendedor, validar que o `artist_id` está em `allowedArtistIds`; senão 403.

A regra existente do limite de 3 shows/dia continua funcionando.

## Frontend

### `src/pages/Usuarios.tsx`

- No diálogo "Convidar usuário": quando `role === "vendedor"`, mostrar lista de artistas com checkboxes para selecionar quais o vendedor pode vender. Enviar `vendedor_artist_ids` no `invite`.
- No diálogo "Editar usuário": se houver papel `vendedor`, mostrar a mesma lista de checkboxes carregada de `u.vendedor_artist_ids`. Enviar junto no `set_roles`.

### Novo `src/components/dashboard/VendedorAgenda.tsx`

- Calendário mensal (`react-day-picker` via `Calendar` do shadcn).
- Filtro por artista (apenas os liberados, vindos de `shows-admin/artists`).
- Carrega dados do mês visível via `shows-admin/list` (combina `shows` próprios + `outras_aprovadas`).
- Marca dias ocupados com bolinha colorida (cor do artista) e badge com a contagem.
- Clique em um dia abre um popover/sheet listando os shows daquele dia:
  - **Próprios**: cartão completo (artista, local, cidade, horário, cachê, status) com link para editar em `/shows`.
  - **De outros vendedores**: somente `Show — [Local] — [Horário]`.
- Botão "Novo Show" no popover (e no topo) que navega para `/shows?new=1&artist=<id>&data=<yyyy-mm-dd>`.
  - Se a data já tiver atingido o limite (3 shows não cancelados), o botão fica desabilitado com tooltip: "Data indisponível para este artista. Limite máximo de shows atingido."

### `src/components/dashboard/VendedorDashboard.tsx`

- Adicionar tabs no topo: **Resumo** (atual) | **Agenda** (novo componente).
- Na tab Resumo, mantém o que já existe.

### `src/pages/Shows.tsx`

- Ler `?new=1&artist=...&data=...` e abrir o diálogo de criação já preenchido (alteração mínima — só pré-popular o estado inicial). Sem mudar regras de validação.

## Detalhes técnicos

- Fonte da verdade da permissão é o backend (RLS + edge functions). O front só esconde UI; quem tenta burlar via API recebe 403.
- Para o vendedor, o calendário usa as cores do artista (`artists.cor`) já presentes no payload.
- Semana segue ISO (segunda a domingo) — já é o padrão do `react-day-picker` configurado no projeto.
- Estrutura preparada para futuras adaptações: as permissões ficam em tabela própria, fáceis de expandir (ex.: permissões de financeiro por artista).

## Arquivos afetados

- Migração SQL nova (tabela `vendedor_artists`, RLS, view atualizada).
- `supabase/functions/users-admin/index.ts`
- `supabase/functions/shows-admin/index.ts`
- `src/pages/Usuarios.tsx`
- `src/pages/Shows.tsx` (apenas pré-popular novo show via querystring)
- `src/components/dashboard/VendedorDashboard.tsx`
- `src/components/dashboard/VendedorAgenda.tsx` (novo)
