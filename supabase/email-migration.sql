-- Additive migration: run after schema.sql. Existing reservations are retained;
-- historical reservations are not sent emails automatically.
begin;
create table if not exists public.reservation_groups (
 id uuid primary key,
 numbers integer[] not null,
 player text not null,
 buyer_name text not null,
 buyer_email text not null,
 created_at timestamptz not null default now()
);
alter table public.reservations add column if not exists group_id uuid references public.reservation_groups(id);
create table if not exists public.reservation_emails (
 group_id uuid not null references public.reservation_groups(id),
 audience text not null check (audience in ('buyer','admin')),
 status text not null default 'pending' check (status in ('pending','sending','accepted','failed','unknown','cancelled')),
 attempts integer not null default 0,
 last_error text,
 updated_at timestamptz not null default now(),
 primary key(group_id,audience)
);
alter table public.reservation_groups enable row level security;
alter table public.reservation_emails enable row level security;
revoke all on public.reservation_groups,public.reservation_emails from public,anon,authenticated;
grant all on public.reservation_groups,public.reservation_emails to service_role;

create or replace function public.reserve_with_emails(p_id uuid,p_numbers integer[],p_player text,p_name text,p_email text)
returns void language plpgsql security invoker set search_path=public as $$
declare previous public.reservation_groups; n integer;
begin
 if p_id is null or p_numbers is null or cardinality(p_numbers) not between 1 and 20
 or (select count(distinct x) from unnest(p_numbers) x) <> cardinality(p_numbers)
 or exists(select 1 from unnest(p_numbers) x where x is null or x not between 1 and 200)
 or p_name is null or length(trim(p_name)) not between 2 and 120
 or p_email is null or length(p_email) not between 3 and 254
 or p_player is null or length(p_player) not between 2 and 100 then raise exception 'Invalid reservation'; end if;
 -- Serialize the same request UUID; unique(number) serializes different buyers.
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into previous from reservation_groups where id=p_id;
 if found then
   if previous.numbers <> p_numbers or previous.player <> p_player or previous.buyer_name <> p_name or previous.buyer_email <> p_email
     or (select count(*) from reservations where group_id=p_id) <> cardinality(previous.numbers) then
     raise exception 'idempotency_conflict';
   end if;
   return;
 end if;
 insert into reservation_groups(id,numbers,player,buyer_name,buyer_email) values(p_id,p_numbers,p_player,p_name,p_email);
 foreach n in array p_numbers loop
   insert into reservations(number,player,buyer_name,buyer_email,group_id) values(n,p_player,p_name,p_email,p_id);
 end loop;
 insert into reservation_emails(group_id,audience) values(p_id,'buyer'),(p_id,'admin');
end $$;
create or replace function public.claim_reservation_emails(p_id uuid)
returns setof public.reservation_emails language sql security invoker set search_path=public as $$
 update reservation_emails e set status='sending',attempts=attempts+1,updated_at=now(),last_error=null
 where group_id=p_id and status in ('pending','failed')
 -- Never send instructions after an administrator released part of the group.
 and (select count(*) from reservations r where r.group_id=p_id) =
 (select cardinality(numbers) from reservation_groups g where g.id=p_id)
 returning e.*;
$$;
revoke all on function public.reserve_with_emails(uuid,integer[],text,text,text), public.claim_reservation_emails(uuid) from public,anon,authenticated;
grant execute on function public.reserve_with_emails(uuid,integer[],text,text,text), public.claim_reservation_emails(uuid) to service_role;
commit;
