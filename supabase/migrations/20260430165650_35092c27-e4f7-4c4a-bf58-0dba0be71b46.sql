
-- 1. Enum de status do show
do $$ begin
  create type public.show_status as enum ('pendente', 'aprovada');
exception when duplicate_object then null; end $$;

-- 2. Colunas novas em shows
alter table public.shows
  add column if not exists status public.show_status not null default 'pendente',
  add column if not exists aprovado_por uuid,
  add column if not exists aprovado_em timestamptz;

-- 3. Tabela de notificações
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tipo text not null check (tipo in ('minuta_aprovada','minuta_rejeitada')),
  titulo text not null,
  mensagem text not null,
  show_id uuid,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, lida, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Usuário vê próprias notificações" on public.notifications;
create policy "Usuário vê próprias notificações"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Usuário atualiza próprias notificações" on public.notifications;
create policy "Usuário atualiza próprias notificações"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Gerente gerencia notificações" on public.notifications;
create policy "Gerente gerencia notificações"
  on public.notifications for all
  to authenticated
  using (public.has_role(auth.uid(), 'gerente'))
  with check (public.has_role(auth.uid(), 'gerente'));

-- 4. Reescrever policies de SELECT em shows
drop policy if exists "Ver shows conforme papel" on public.shows;
create policy "Ver shows conforme papel"
  on public.shows for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'gerente')
    or public.has_role(auth.uid(), 'equipe')
    or (public.has_role(auth.uid(), 'vendedor') and created_by = auth.uid())
    or (public.has_role(auth.uid(), 'artista') and artist_id = public.get_my_artist_id())
  );

-- 5. View pública para vendedores verem dados mínimos de aprovadas alheias
create or replace view public.shows_public_view
with (security_invoker = on) as
select
  s.id,
  s.artist_id,
  a.nome as artist_nome,
  a.cor as artist_cor,
  s.data_show,
  s.horario,
  s.local,
  s.cidade,
  s.created_by,
  s.status
from public.shows s
left join public.artists a on a.id = s.artist_id
where s.status = 'aprovada';

grant select on public.shows_public_view to authenticated;
