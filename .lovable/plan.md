# Bloqueio de datas por artista

Permitir que o **gerente** trave datas em que um artista não pode ter shows criados — por opção do artista, férias, compromissos pessoais, manutenção etc. Vendedores e equipe ficam impedidos de cadastrar shows nessa data para o artista bloqueado.

## 1. Escopo do bloqueio

- Bloqueio é **por artista + data** (um artista pode estar bloqueado num dia e outro livre).
- Opção extra: bloqueio **global** (todos os artistas) — útil para feriados internos da casa. Implementado como `artist_id NULL`.
- Apenas **gerente** cria, edita ou remove bloqueios.
- Bloqueio impede **criar** novo show; shows já existentes naquela data continuam válidos (gerente decide se cancela manualmente).

## 2. Banco

Nova tabela `blocked_dates`:

| campo | tipo | obs |
|---|---|---|
| id | uuid PK | |
| artist_id | uuid NULL | NULL = bloqueio global |
| data | date NOT NULL | |
| motivo | text | livre, ex.: "Férias", "Folga do artista" |
| created_by | uuid | gerente que criou |
| created_at | timestamptz | |

- Índice único `(artist_id, data)` (NULLs distintos permitidos — só um bloqueio global por dia).
- RLS:
  - SELECT: qualquer autenticado (vendedor precisa enxergar para feedback no formulário).
  - INSERT/UPDATE/DELETE: apenas gerente.

## 3. Validação na criação de show

Na edge function `shows-admin` action `create`, **antes** das outras travas:

1. Buscar em `blocked_dates` onde `data = data_show` e (`artist_id = $artist_id` OR `artist_id IS NULL`).
2. Se encontrar:
   - 409 com mensagem: `"Esta data está bloqueada para este artista (motivo: {motivo}). Fale com a gerência."` (ou variante para bloqueio global).
3. Gerente **bypassa** a trava (pode forçar criação se necessário), igual ao padrão das outras travas.

Mesma checagem replicada no frontend (`Shows.tsx`) para feedback antes do submit.

## 4. Frontend

### 4.1 Nova página `Bloqueios` (gerente)

- Rota `/bloqueios`, item na sidebar visível só para gerente.
- Lista paginada por mês: artista (ou "TODOS"), data, motivo, ações (editar / remover).
- Botão "Bloquear data" abre dialog com:
  - Seletor de artista (com opção "Todos os artistas").
  - Datepicker (single ou intervalo — começo simples, single date; se quiserem intervalo, gero N registros).
  - Campo motivo (texto curto).
- Filtros: por artista e por mês.

### 4.2 Indicador no formulário de Show

- Em `Shows.tsx`, ao escolher artista + data, se houver bloqueio: badge vermelho "Data bloqueada — {motivo}" e botão Salvar desabilitado (gerente vê um aviso amarelo mas pode salvar).

### 4.3 Agenda / Dashboard

- Marcar visualmente os dias bloqueados (faixa cinza listrada). Fora do escopo se não pedirem — incluo só o aviso "X bloqueio(s) este mês" no Dashboard do gerente.

## 5. Notificações

- Ao criar bloqueio: notificar o **artista** correspondente in-app ("Sua agenda foi bloqueada em {data} — motivo: {motivo}").
- Bloqueio global: não notifica artistas individualmente.

## 6. Fora desta entrega

- Bloqueio recorrente (toda segunda, etc.).
- Bloqueio por intervalo de horas (apenas dia inteiro).
- Sincronização do bloqueio com Google Calendar.

---

Se aprovar, sigo: migração da tabela `blocked_dates` → atualizar `shows-admin` → criar página `Bloqueios` + entrada na sidebar → indicador no formulário de show.