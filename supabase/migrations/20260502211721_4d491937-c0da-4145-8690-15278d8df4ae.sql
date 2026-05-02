
alter table public.shows add column if not exists notificacao_12h_enviada boolean not null default false;

insert into public.app_settings (key, value, description)
values ('feriados_nacionais_fixos', '["01-01","04-21","05-01","09-07","10-12","11-02","11-15","12-25"]'::jsonb, 'Feriados nacionais fixos (MM-DD) considerados não-úteis')
on conflict (key) do nothing;

create or replace function public.is_business_day_br(d date)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  dow int := extract(isodow from d);
  mmdd text := to_char(d, 'MM-DD');
  feriados jsonb;
begin
  if dow >= 6 then return false; end if;
  select value into feriados from public.app_settings where key = 'feriados_nacionais_fixos';
  if feriados is null then return true; end if;
  return not (feriados ? mmdd);
end;
$$;

create or replace function public.add_business_hours_br(start_ts timestamptz, hours_to_add numeric)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  remaining numeric := hours_to_add;
  cur timestamptz := start_ts;
  step numeric;
  hours_in_day numeric;
begin
  while remaining > 0 loop
    if not public.is_business_day_br(cur::date) then
      cur := date_trunc('day', cur) + interval '1 day';
      continue;
    end if;
    hours_in_day := 24 - extract(epoch from (cur - date_trunc('day', cur))) / 3600;
    step := least(remaining, hours_in_day);
    cur := cur + (step || ' hours')::interval;
    remaining := remaining - step;
  end loop;
  return cur;
end;
$$;
