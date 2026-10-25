-- Rockets du Nord : exécuter dans Supabase > SQL Editor
create table if not exists public.reservations (
  id bigint generated always as identity primary key,
  number integer not null unique check (number between 1 and 200),
  player text not null check (length(player) between 2 and 100),
  buyer_name text not null check (length(buyer_name) between 2 and 120),
  buyer_email text not null check (length(buyer_email) between 3 and 254),
  status text not null default 'pending' check (status in ('pending','paid')),
  created_at timestamptz not null default now()
);
create index if not exists reservations_status_idx on public.reservations(status);
alter table public.reservations enable row level security;
-- Aucune policy publique : seul le serveur (service role) peut lire ou écrire.
revoke all on public.reservations from anon, authenticated;
-- Cette fonction réserve tous les numéros demandés atomiquement.
create or replace function public.reserve_numbers(
  p_numbers integer[], p_player text, p_buyer_name text, p_buyer_email text
) returns void language plpgsql security invoker set search_path = public as $$
declare n integer;
begin
  if p_numbers is null or cardinality(p_numbers) < 1 or cardinality(p_numbers) > 20
    or (select count(distinct x) from unnest(p_numbers) x) <> cardinality(p_numbers)
    or exists (select 1 from unnest(p_numbers) x where x < 1 or x > 200 or x is null)
    or length(trim(p_player)) < 2 or length(trim(p_buyer_name)) < 2
    or length(trim(p_buyer_email)) < 3 then
    raise exception 'Données invalides';
  end if;
  foreach n in array p_numbers loop
    insert into public.reservations(number,player,buyer_name,buyer_email)
    values(n,trim(p_player),trim(p_buyer_name),trim(p_buyer_email));
  end loop;
end $$;
revoke all on function public.reserve_numbers(integer[],text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_numbers(integer[],text,text,text) to service_role;
-- Administration : dans Table Editor, passer status à paid ou supprimer une ligne pour libérer un numéro.
