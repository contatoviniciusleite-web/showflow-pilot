
-- Set search_path on remaining functions
create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email));
  return new;
end; $$;

-- Revoke public execution of SECURITY DEFINER helpers (only callable from RLS / our code)
revoke execute on function public.has_role(uuid, app_role) from public, anon, authenticated;
revoke execute on function public.get_my_artist_id() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
-- They still work inside RLS / triggers because they run as definer
