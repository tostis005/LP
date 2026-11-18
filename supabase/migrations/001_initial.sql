-- LP: modelo multiempresa, aislamiento de datos y operaciones seguras
-- Ejecutar una vez en un proyecto Supabase nuevo. No usar la service role en el navegador.
create extension if not exists pgcrypto;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now()
);
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  category text,
  logo_url text,
  accent_color text not null default '#264d3e',
  card_background text,
  card_text text,
  public_listing boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','employee')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id,user_id)
);
create table public.business_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner','manager','employee')),
  invited_by uuid references auth.users(id),
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index invites_pending_unique on public.business_invitations(business_id,lower(email)) where claimed_at is null;
create table public.loyalty_programs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  type text not null default 'stamps' check (type in ('stamps','points','cashback')),
  reward_label text not null default 'Una recompensa gratis',
  reward_cost integer not null default 8 check (reward_cost > 0),
  cashback_bps integer not null default 500 check (cashback_bps between 1 and 10000),
  points_per_euro numeric(8,2) not null default 1 check (points_per_euro > 0 and points_per_euro <= 100),
  max_stamps_per_action integer not null default 3 check (max_stamps_per_action between 1 and 100),
  max_ticket_cents integer not null default 50000 check (max_ticket_cents between 100 and 100000000),
  min_seconds_between_awards integer not null default 30 check (min_seconds_between_awards between 0 and 86400),
  updated_at timestamptz not null default now()
);
create table public.loyalty_memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  card_token uuid not null unique default gen_random_uuid(),
  balance integer not null default 0 check (balance >= 0),
  total_earned integer not null default 0 check (total_earned >= 0),
  created_at timestamptz not null default now(),
  unique (business_id,customer_id)
);
create table public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  membership_id uuid not null references public.loyalty_memberships(id) on delete cascade,
  employee_id uuid references auth.users(id),
  kind text not null check (kind in ('earn','redeem')),
  amount_delta integer not null check (amount_delta <> 0),
  purchase_cents integer,
  ticket_ref text,
  created_at timestamptz not null default now()
);
create unique index transaction_ticket_unique on public.loyalty_transactions(business_id,ticket_ref)
  where ticket_ref is not null and kind='earn';
create index transactions_membership_date on public.loyalty_transactions(membership_id,created_at desc);
create index transactions_business_date on public.loyalty_transactions(business_id,created_at desc);
create index memberships_customer_idx on public.loyalty_memberships(customer_id);
create table public.business_locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  address text not null,
  city text not null,
  country text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  visible boolean not null default true,
  created_at timestamptz not null default now()
);
create index business_locations_geo_idx on public.business_locations(country,city);
create table public.marketing_consents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  opted_in boolean not null default false,
  updated_at timestamptz not null default now()
);
create unique index consents_platform_unique on public.marketing_consents(customer_id) where business_id is null;
create unique index consents_business_unique on public.marketing_consents(customer_id,business_id) where business_id is not null;
create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  subject text not null,
  body_text text not null,
  status text not null default 'draft' check (status in ('draft')),
  created_at timestamptz not null default now()
);

-- Perfil automático al registrarse
create or replace function public.new_user_profile() returns trigger language plpgsql security definer
set search_path=public as $$
begin
  insert into public.profiles(id,full_name) values (new.id,coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict(id) do nothing;
  return new;
end; $$;
create trigger trg_new_user_profile after insert on auth.users
for each row execute function public.new_user_profile();

-- Comprobadores de rol SECURITY DEFINER para evitar recursión RLS
create or replace function public.is_platform_admin() returns boolean language sql stable security definer
set search_path=public as $$
 select exists(select 1 from public.platform_admins where user_id=auth.uid());
$$;
create or replace function public.is_business_staff(p_business uuid) returns boolean language sql stable security definer
set search_path=public as $$
 select exists(select 1 from public.business_members
 where business_id=p_business and user_id=auth.uid() and active=true);
$$;
create or replace function public.is_business_manager(p_business uuid) returns boolean language sql stable security definer
set search_path=public as $$
 select exists(select 1 from public.business_members
 where business_id=p_business and user_id=auth.uid() and active=true and role in ('owner','manager'));
$$;
create or replace function public.is_business_owner(p_business uuid) returns boolean language sql stable security definer
set search_path=public as $$
 select exists(select 1 from public.business_members
 where business_id=p_business and user_id=auth.uid() and active=true and role='owner');
$$;

alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.business_invitations enable row level security;
alter table public.loyalty_programs enable row level security;
alter table public.loyalty_memberships enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.business_locations enable row level security;
alter table public.marketing_consents enable row level security;
alter table public.marketing_campaigns enable row level security;

create policy profiles_read on public.profiles for select to authenticated
 using (id=auth.uid() or (select public.is_platform_admin()));
create policy profiles_update on public.profiles for update to authenticated
 using (id=auth.uid()) with check (id=auth.uid());
create policy admin_users_read on public.platform_admins for select to authenticated
 using (user_id=auth.uid() or (select public.is_platform_admin()));
create policy businesses_read on public.businesses for select to authenticated
 using ((active and public_listing) or public.is_business_staff(id) or (select public.is_platform_admin())
   or exists(select 1 from public.loyalty_memberships m where m.business_id=id and m.customer_id=auth.uid()));
create policy businesses_update on public.businesses for update to authenticated
 using (public.is_business_manager(id) or (select public.is_platform_admin()))
 with check (public.is_business_manager(id) or (select public.is_platform_admin()));
create policy members_read on public.business_members for select to authenticated
 using (user_id=auth.uid() or public.is_business_manager(business_id) or (select public.is_platform_admin()));
create policy invites_read on public.business_invitations for select to authenticated
 using (public.is_business_manager(business_id) or (select public.is_platform_admin())
   or (lower(email)=lower(auth.jwt()->>'email')));
create policy programs_read on public.loyalty_programs for select to authenticated
 using (public.is_business_staff(business_id) or (select public.is_platform_admin())
   or exists (select 1 from public.businesses b where b.id=business_id and b.active and b.public_listing)
   or exists (select 1 from public.loyalty_memberships m where m.business_id=loyalty_programs.business_id and m.customer_id=auth.uid()));
create policy programs_update on public.loyalty_programs for update to authenticated
 using (public.is_business_manager(business_id) or (select public.is_platform_admin()))
 with check (public.is_business_manager(business_id) or (select public.is_platform_admin()));
create policy memberships_read on public.loyalty_memberships for select to authenticated
 using (customer_id=auth.uid() or public.is_business_staff(business_id) or (select public.is_platform_admin()));
create policy transactions_read on public.loyalty_transactions for select to authenticated
 using (public.is_business_staff(business_id) or (select public.is_platform_admin())
 or exists(select 1 from public.loyalty_memberships m where m.id=membership_id and m.customer_id=auth.uid()));
create policy locations_read on public.business_locations for select to authenticated
 using (public.is_business_staff(business_id) or (select public.is_platform_admin()) or
 (visible and exists(select 1 from public.businesses b where b.id=business_id and b.public_listing and b.active)));
create policy locations_insert on public.business_locations for insert to authenticated
 with check (public.is_business_manager(business_id) or (select public.is_platform_admin()));
create policy locations_update on public.business_locations for update to authenticated
 using (public.is_business_manager(business_id) or (select public.is_platform_admin()))
 with check (public.is_business_manager(business_id) or (select public.is_platform_admin()));
create policy locations_delete on public.business_locations for delete to authenticated
 using (public.is_business_manager(business_id) or (select public.is_platform_admin()));
create policy consents_read on public.marketing_consents for select to authenticated
 using (customer_id=auth.uid() or (select public.is_platform_admin()) or
 (business_id is not null and public.is_business_manager(business_id)));
create policy consents_insert on public.marketing_consents for insert to authenticated
 with check (customer_id=auth.uid() and (business_id is null or exists(
 select 1 from public.loyalty_memberships m where m.customer_id=auth.uid() and m.business_id=business_id)));
create policy consents_update on public.marketing_consents for update to authenticated
 using (customer_id=auth.uid()) with check (customer_id=auth.uid());
create policy campaigns_read on public.marketing_campaigns for select to authenticated
 using ((business_id is null and (select public.is_platform_admin()))
 or (business_id is not null and public.is_business_manager(business_id)));
create policy campaigns_insert on public.marketing_campaigns for insert to authenticated
 with check (created_by=auth.uid() and
 ((business_id is null and (select public.is_platform_admin())) or
  (business_id is not null and public.is_business_manager(business_id))));

-- Solo funciones autorizadas escriben cuentas, invitaciones y movimientos
create or replace function public.admin_create_business(p_name text,p_slug text,p_manager_email text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if not public.is_platform_admin() then raise exception 'No autorizado'; end if;
 if length(trim(p_name))<2 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Nombre o slug no válido'; end if;
 if position('@' in coalesce(p_manager_email,''))=0 then raise exception 'Email del responsable obligatorio'; end if;
 insert into public.businesses(name,slug) values(trim(p_name),p_slug) returning id into v_id;
 insert into public.loyalty_programs(business_id) values(v_id);
 insert into public.business_invitations(business_id,email,role,invited_by)
 values(v_id,lower(trim(p_manager_email)),'owner',auth.uid());
 return v_id;
end; $$;

create or replace function public.invite_staff(p_business uuid,p_email text,p_role text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if not (public.is_business_manager(p_business) or public.is_platform_admin()) then raise exception 'No autorizado'; end if;
 if p_role not in ('manager','employee') then raise exception 'Rol no permitido'; end if;
 if p_role='manager' and not (public.is_business_owner(p_business) or public.is_platform_admin()) then raise exception 'Solo el propietario puede invitar managers'; end if;
 if position('@' in coalesce(p_email,''))=0 then raise exception 'Email no válido'; end if;
 insert into public.business_invitations(business_id,email,role,invited_by)
 values(p_business,lower(trim(p_email)),p_role,auth.uid()) returning id into v_id;
 return v_id;
end; $$;

create or replace function public.claim_invitations() returns integer language plpgsql security definer
set search_path=public as $$
declare v_email text; v_total int := 0; v_inv record;
begin
 select lower(email) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if v_email is null then raise exception 'Verifica primero tu correo'; end if;
 for v_inv in select * from public.business_invitations
   where lower(email)=v_email and claimed_at is null for update loop
   insert into public.business_members(business_id,user_id,role) values(v_inv.business_id,auth.uid(),v_inv.role)
   on conflict(business_id,user_id) do nothing;
   update public.business_invitations set claimed_at=now() where id=v_inv.id;
   v_total:=v_total+1;
 end loop;
 return v_total;
end; $$;

create or replace function public.set_staff_active(p_business uuid,p_user uuid,p_active boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_role text;
begin
 if not (public.is_business_manager(p_business) or public.is_platform_admin()) then raise exception 'No autorizado'; end if;
 select role into v_role from public.business_members where business_id=p_business and user_id=p_user;
 if v_role='owner' then raise exception 'No se puede desactivar al propietario'; end if;
 if v_role='manager' and not (public.is_business_owner(p_business) or public.is_platform_admin()) then raise exception 'Solo el propietario puede gestionar managers'; end if;
 update public.business_members set active=p_active where business_id=p_business and user_id=p_user;
end; $$;

create or replace function public.join_program(p_business uuid) returns uuid language plpgsql security definer
set search_path=public as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Identifícate para unirte'; end if;
 if not exists(select 1 from public.businesses where id=p_business and active and public_listing)
   then raise exception 'Programa no disponible'; end if;
 insert into public.loyalty_memberships(business_id,customer_id)
 values(p_business,auth.uid()) on conflict(business_id,customer_id) do nothing;
 select id into v_id from public.loyalty_memberships where business_id=p_business and customer_id=auth.uid();
 return v_id;
end; $$;

create or replace function public.staff_lookup_card(p_token uuid)
returns table(membership_id uuid,business_id uuid,business_name text,customer_name text,
 program_type text,balance integer,reward_label text,reward_cost integer)
language plpgsql security definer set search_path=public as $$
begin
 return query select m.id,b.id,b.name,p.full_name,pr.type,m.balance,pr.reward_label,pr.reward_cost
 from public.loyalty_memberships m
 join public.businesses b on b.id=m.business_id
 join public.loyalty_programs pr on pr.business_id=b.id
 join public.profiles p on p.id=m.customer_id
 where m.card_token=p_token and b.active and public.is_business_staff(m.business_id);
end; $$;

create or replace function public.staff_award_card(p_token uuid,p_purchase_cents integer default 0,
 p_stamps integer default 1,p_ticket_ref text default null)
returns integer language plpgsql security definer set search_path=public as $$
declare v_m public.loyalty_memberships%rowtype; v_p public.loyalty_programs%rowtype;
  v_delta int; v_ref text; v_last timestamptz;
begin
 select * into v_m from public.loyalty_memberships where card_token=p_token for update;
 if not found then raise exception 'Tarjeta no encontrada'; end if;
 if not public.is_business_staff(v_m.business_id) or not exists(select 1 from public.businesses where id=v_m.business_id and active)
   then raise exception 'Acceso denegado'; end if;
 select * into v_p from public.loyalty_programs where business_id=v_m.business_id;
 select max(created_at) into v_last from public.loyalty_transactions
 where membership_id=v_m.id and kind='earn';
 if v_last is not null and v_last > now()-make_interval(secs=>v_p.min_seconds_between_awards)
   then raise exception 'Espera antes de registrar otra operación en esta tarjeta'; end if;
 if v_p.type='stamps' then
   if p_stamps<1 or p_stamps>v_p.max_stamps_per_action then raise exception 'Número de sellos fuera del límite'; end if;
   v_delta:=p_stamps;
 else
   if p_purchase_cents<1 or p_purchase_cents>v_p.max_ticket_cents then raise exception 'Importe fuera del límite'; end if;
   if v_p.type='cashback' then v_delta:=floor(p_purchase_cents::numeric*v_p.cashback_bps/10000)::int;
   else v_delta:=floor(p_purchase_cents::numeric*v_p.points_per_euro/100)::int;
   end if;
   if v_delta<1 then raise exception 'Importe demasiado pequeño para generar saldo'; end if;
 end if;
 v_ref:=nullif(left(trim(coalesce(p_ticket_ref,'')),100),'');
 insert into public.loyalty_transactions(business_id,membership_id,employee_id,kind,amount_delta,purchase_cents,ticket_ref)
 values(v_m.business_id,v_m.id,auth.uid(),'earn',v_delta,
 case when v_p.type='stamps' then null else p_purchase_cents end,v_ref);
 update public.loyalty_memberships set balance=balance+v_delta,total_earned=total_earned+v_delta where id=v_m.id;
 return v_m.balance+v_delta;
end; $$;

create or replace function public.staff_redeem_card(p_token uuid,p_cashback_cents integer default null)
returns integer language plpgsql security definer set search_path=public as $$
declare v_m public.loyalty_memberships%rowtype; v_p public.loyalty_programs%rowtype; v_cost int;
begin
 select * into v_m from public.loyalty_memberships where card_token=p_token for update;
 if not found then raise exception 'Tarjeta no encontrada'; end if;
 if not public.is_business_staff(v_m.business_id) or not exists(select 1 from public.businesses where id=v_m.business_id and active)
 then raise exception 'Acceso denegado'; end if;
 select * into v_p from public.loyalty_programs where business_id=v_m.business_id;
 v_cost:=case when v_p.type='cashback' then p_cashback_cents else v_p.reward_cost end;
 if v_cost is null or v_cost<=0 then raise exception 'Indica cuánto cashback canjear'; end if;
 if v_m.balance<v_cost then raise exception 'Saldo insuficiente'; end if;
 insert into public.loyalty_transactions(business_id,membership_id,employee_id,kind,amount_delta)
 values(v_m.business_id,v_m.id,auth.uid(),'redeem',-v_cost);
 update public.loyalty_memberships set balance=balance-v_cost where id=v_m.id;
 return v_m.balance-v_cost;
end; $$;

-- Consentimientos separados y auditables por cliente (plataforma / negocio)
-- Suscripción real de pagos y emails de marketing requieren integración externa.
create or replace function public.platform_upsert_consent(p_opted_in boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'No autorizado'; end if;
 insert into public.marketing_consents(customer_id,business_id,opted_in)
 values(auth.uid(),null,p_opted_in)
 on conflict(customer_id) where business_id is null
 do update set opted_in=excluded.opted_in,updated_at=now();
end; $$;
create or replace function public.business_upsert_consent(p_business uuid,p_opted_in boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.loyalty_memberships where customer_id=auth.uid() and business_id=p_business)
 then raise exception 'No estás inscrito'; end if;
 insert into public.marketing_consents(customer_id,business_id,opted_in)
 values(auth.uid(),p_business,p_opted_in)
 on conflict(customer_id,business_id) where business_id is not null
 do update set opted_in=excluded.opted_in,updated_at=now();
end; $$;

revoke execute on function public.admin_create_business(text,text,text) from public,anon;
revoke execute on function public.invite_staff(uuid,text,text) from public,anon;
revoke execute on function public.claim_invitations() from public,anon;
revoke execute on function public.set_staff_active(uuid,uuid,boolean) from public,anon;
revoke execute on function public.join_program(uuid) from public,anon;
revoke execute on function public.staff_lookup_card(uuid) from public,anon;
revoke execute on function public.staff_award_card(uuid,integer,integer,text) from public,anon;
revoke execute on function public.staff_redeem_card(uuid,integer) from public,anon;
revoke execute on function public.platform_upsert_consent(boolean) from public,anon;
revoke execute on function public.business_upsert_consent(uuid,boolean) from public,anon;
grant execute on function public.admin_create_business(text,text,text) to authenticated;
grant execute on function public.invite_staff(uuid,text,text) to authenticated;
grant execute on function public.claim_invitations() to authenticated;
grant execute on function public.set_staff_active(uuid,uuid,boolean) to authenticated;
grant execute on function public.join_program(uuid) to authenticated;
grant execute on function public.staff_lookup_card(uuid) to authenticated;
grant execute on function public.staff_award_card(uuid,integer,integer,text) to authenticated;
grant execute on function public.staff_redeem_card(uuid,integer) to authenticated;
grant execute on function public.platform_upsert_consent(boolean) to authenticated;
grant execute on function public.business_upsert_consent(uuid,boolean) to authenticated;

-- Almacenamiento de fondos / logos públicos por negocio, escritura controlada
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('business-assets','business-assets',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy business_assets_insert on storage.objects for insert to authenticated with check (
 bucket_id='business-assets'
 and public.is_business_manager(((storage.foldername(name))[1])::uuid));
create policy business_assets_update on storage.objects for update to authenticated using (
 bucket_id='business-assets'
 and public.is_business_manager(((storage.foldername(name))[1])::uuid))
 with check(bucket_id='business-assets' and public.is_business_manager(((storage.foldername(name))[1])::uuid));
create policy business_assets_delete on storage.objects for delete to authenticated using (
 bucket_id='business-assets' and public.is_business_manager(((storage.foldername(name))[1])::uuid));
