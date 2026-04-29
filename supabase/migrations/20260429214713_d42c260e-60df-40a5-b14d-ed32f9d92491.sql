
-- ENUMS
create type public.app_role as enum ('gerente', 'equipe', 'artista');
create type public.estrutura_tipo as enum ('aberta', 'fechada');
create type public.deposito_status as enum ('ok', 'pendente');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- USER ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  artist_id uuid, -- preenchido se role = artista
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- has_role (security definer evita recursão)
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- get_my_artist_id (para RLS de artista)
create or replace function public.get_my_artist_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select artist_id from public.user_roles
  where user_id = auth.uid() and role = 'artista'
  limit 1
$$;

-- ARTISTS
create table public.artists (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  foto_url text,
  google_calendar_id text,
  rider_padrao text default '',
  cor text not null default '#f59e0b',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.artists enable row level security;

alter table public.user_roles
  add constraint user_roles_artist_fk foreign key (artist_id) references public.artists(id) on delete set null;

-- SHOWS
create table public.shows (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete restrict,
  -- Informações do show
  data_show date not null,
  horario time,
  local text,
  tipo_estrutura estrutura_tipo,
  endereco text,
  cidade text,
  capacidade integer,
  -- Financeiro
  cache_total numeric(12,2) not null default 0,
  condicao_pagamento text,
  encargos_extras boolean not null default false,
  -- Contratante
  contratante_nome text,
  contratante_documento text, -- CPF/CNPJ
  contratante_endereco text,
  contratante_cidade text,
  contratante_cep text,
  contratante_telefone text,
  contratante_email text,
  -- Transporte
  transp_onibus boolean not null default false,
  transp_van boolean not null default false,
  transp_aereo boolean not null default false,
  transp_excesso_bagagem boolean not null default false,
  transp_observacoes text,
  -- Hospitalidade
  camarins_rider text,
  hosp_diaria_alimentacao boolean not null default false,
  hosp_hospedagem boolean not null default false,
  hosp_traslado boolean not null default false,
  -- Controle interno
  vendedor text,
  data_subida date,
  autorizado_por text default 'Vitor D.',
  -- Meta
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.shows enable row level security;
create index shows_artist_idx on public.shows(artist_id);
create index shows_data_idx on public.shows(data_show);

-- SHOW DEPOSITS
create table public.show_deposits (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  valor numeric(12,2) not null default 0,
  data date,
  responsavel text,
  status deposito_status not null default 'pendente',
  observacao text,
  created_at timestamptz not null default now()
);
alter table public.show_deposits enable row level security;
create index deposits_show_idx on public.show_deposits(show_id);

-- SHOW EXPENSES
create table public.show_expenses (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  categoria text not null default 'outras', -- viagem, hospedagem, rider, outras (livre)
  descricao text,
  valor numeric(12,2) not null default 0,
  data date,
  created_at timestamptz not null default now()
);
alter table public.show_expenses enable row level security;
create index expenses_show_idx on public.show_expenses(show_id);

-- SHOW CALENDAR EVENTS
create table public.show_calendar_events (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  google_event_id text,
  google_calendar_id text,
  last_synced_at timestamptz,
  sync_error text,
  created_at timestamptz not null default now(),
  unique(show_id)
);
alter table public.show_calendar_events enable row level security;

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_artists_updated before update on public.artists
  for each row execute function public.set_updated_at();
create trigger trg_shows_updated before update on public.shows
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ RLS POLICIES ============

-- profiles
create policy "Usuário vê próprio perfil" on public.profiles
  for select to authenticated using (auth.uid() = id or public.has_role(auth.uid(), 'gerente'));
create policy "Usuário atualiza próprio perfil" on public.profiles
  for update to authenticated using (auth.uid() = id);
create policy "Usuário insere próprio perfil" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- user_roles: só gerente gerencia; usuário vê os próprios papéis
create policy "Ver próprios papéis" on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'gerente'));
create policy "Gerente gerencia papéis" on public.user_roles
  for all to authenticated using (public.has_role(auth.uid(), 'gerente'))
  with check (public.has_role(auth.uid(), 'gerente'));

-- artists
create policy "Autenticados veem artistas" on public.artists
  for select to authenticated using (true);
create policy "Gerente gerencia artistas" on public.artists
  for all to authenticated using (public.has_role(auth.uid(), 'gerente'))
  with check (public.has_role(auth.uid(), 'gerente'));

-- shows
create policy "Ver shows conforme papel" on public.shows
  for select to authenticated using (
    public.has_role(auth.uid(), 'gerente')
    or public.has_role(auth.uid(), 'equipe')
    or (public.has_role(auth.uid(), 'artista') and artist_id = public.get_my_artist_id())
  );
create policy "Gerente e equipe criam shows" on public.shows
  for insert to authenticated with check (
    public.has_role(auth.uid(), 'gerente') or public.has_role(auth.uid(), 'equipe')
  );
create policy "Gerente e equipe atualizam shows" on public.shows
  for update to authenticated using (
    public.has_role(auth.uid(), 'gerente') or public.has_role(auth.uid(), 'equipe')
  );
create policy "Gerente exclui shows" on public.shows
  for delete to authenticated using (public.has_role(auth.uid(), 'gerente'));

-- show_deposits
create policy "Ver depósitos conforme papel" on public.show_deposits
  for select to authenticated using (
    exists (
      select 1 from public.shows s where s.id = show_id and (
        public.has_role(auth.uid(), 'gerente')
        or public.has_role(auth.uid(), 'equipe')
        or (public.has_role(auth.uid(), 'artista') and s.artist_id = public.get_my_artist_id())
      )
    )
  );
create policy "Gerente e equipe gerenciam depósitos" on public.show_deposits
  for all to authenticated using (
    public.has_role(auth.uid(), 'gerente') or public.has_role(auth.uid(), 'equipe')
  ) with check (
    public.has_role(auth.uid(), 'gerente') or public.has_role(auth.uid(), 'equipe')
  );

-- show_expenses
create policy "Ver despesas conforme papel" on public.show_expenses
  for select to authenticated using (
    exists (
      select 1 from public.shows s where s.id = show_id and (
        public.has_role(auth.uid(), 'gerente')
        or public.has_role(auth.uid(), 'equipe')
        or (public.has_role(auth.uid(), 'artista') and s.artist_id = public.get_my_artist_id())
      )
    )
  );
create policy "Gerente e equipe gerenciam despesas" on public.show_expenses
  for all to authenticated using (
    public.has_role(auth.uid(), 'gerente') or public.has_role(auth.uid(), 'equipe')
  ) with check (
    public.has_role(auth.uid(), 'gerente') or public.has_role(auth.uid(), 'equipe')
  );

-- show_calendar_events: leitura conforme show, escrita só sistema (gerente/equipe)
create policy "Ver eventos calendário conforme papel" on public.show_calendar_events
  for select to authenticated using (
    exists (
      select 1 from public.shows s where s.id = show_id and (
        public.has_role(auth.uid(), 'gerente')
        or public.has_role(auth.uid(), 'equipe')
        or (public.has_role(auth.uid(), 'artista') and s.artist_id = public.get_my_artist_id())
      )
    )
  );
create policy "Gerente e equipe gerenciam eventos calendário" on public.show_calendar_events
  for all to authenticated using (
    public.has_role(auth.uid(), 'gerente') or public.has_role(auth.uid(), 'equipe')
  ) with check (
    public.has_role(auth.uid(), 'gerente') or public.has_role(auth.uid(), 'equipe')
  );

-- Storage bucket para fotos de artistas
insert into storage.buckets (id, name, public) values ('artists', 'artists', true)
  on conflict (id) do nothing;

create policy "Fotos de artistas são públicas"
  on storage.objects for select using (bucket_id = 'artists');
create policy "Gerente faz upload de fotos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'artists' and public.has_role(auth.uid(), 'gerente'));
create policy "Gerente atualiza fotos"
  on storage.objects for update to authenticated
  using (bucket_id = 'artists' and public.has_role(auth.uid(), 'gerente'));
create policy "Gerente apaga fotos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'artists' and public.has_role(auth.uid(), 'gerente'));
