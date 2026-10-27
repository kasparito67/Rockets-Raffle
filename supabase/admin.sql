-- À exécuter dans Supabase SQL Editor après schema.sql.
create table if not exists public.raffle_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.raffle_admins enable row level security;
revoke all on public.raffle_admins from anon, authenticated;
-- Dans Supabase > Authentication > Users, créer un utilisateur admin.
-- Puis remplacer l'adresse ci-dessous et exécuter cette instruction séparément :
-- insert into public.raffle_admins(user_id)
-- select id from auth.users where email = 'VOTRE_ADRESSE_EMAIL';
-- Plus tard, ajouter la gérante de la même manière et retirer votre accès :
-- delete from public.raffle_admins where user_id = 'UUID_DE_L_ANCIEN_ADMIN';
