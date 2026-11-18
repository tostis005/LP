-- LP: estructura de facturación SaaS. La aplicación NO exige pagos
-- hasta activar explícitamente billing_enforced después de configurar Stripe.
create table public.platform_billing_settings(
 id boolean primary key default true check (id),
 billing_enforced boolean not null default false,
 updated_at timestamptz not null default now()
);
insert into public.platform_billing_settings(id,billing_enforced) values(true,false);

create table public.business_billing (
 business_id uuid primary key references public.businesses(id) on delete cascade,
 plan text not null default 'business' check (plan in ('business')),
 status text not null default 'trialing'
  check (status in ('trialing','active','past_due','canceled','unpaid','incomplete',
                   'incomplete_expired','paused')),
 trial_ends_at timestamptz,
 stripe_customer_id text unique,
 stripe_subscription_id text unique,
 last_stripe_event_created bigint not null default 0,
 updated_at timestamptz not null default now()
);
alter table public.business_billing enable row level security;
alter table public.platform_billing_settings enable row level security;
create policy business_billing_read on public.business_billing for select to authenticated
using (public.is_business_manager(business_id) or (select public.is_platform_admin()));
create policy platform_billing_settings_admin_read on public.platform_billing_settings
for select to authenticated using ((select public.is_platform_admin()));

create or replace function public.create_business_billing()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.business_billing(business_id,trial_ends_at)
 values(new.id,now()+interval '14 days')
 on conflict(business_id) do nothing;
 return new;
end; $$;
create trigger business_billing_auto after insert on public.businesses
for each row execute function public.create_business_billing();
insert into public.business_billing(business_id,trial_ends_at)
select id,created_at+interval '14 days' from public.businesses
on conflict (business_id) do nothing;

-- Borrador por defecto: cobros en modo de preparación. Solo un administrador
-- con acceso SQL debe habilitar billing_enforced tras pruebas reales de Stripe.
create or replace function public.business_billing_allowed(p_business uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select case
  when (select not billing_enforced from public.platform_billing_settings where id=true) then true
  else exists (
   select 1 from public.business_billing b where b.business_id=p_business
    and (b.status='active' or (b.status='trialing' and b.trial_ends_at>now()))
  )
 end
$$;

create or replace function public.guard_subscription_on_transaction()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.kind in ('earn','redeem') and not public.business_billing_allowed(new.business_id) then
   raise exception 'La suscripción del negocio no permite nuevas operaciones';
 end if;
 return new;
end; $$;
create trigger guard_subscription_transaction before insert on public.loyalty_transactions
 for each row execute function public.guard_subscription_on_transaction();

-- Función reemplazada para que también controle la emisión de tarjetas.
create or replace function public.join_program(p_business uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Identifícate para unirte'; end if;
 if not exists(select 1 from public.businesses where id=p_business and active)
   then raise exception 'Programa no disponible'; end if;
 if not public.business_billing_allowed(p_business)
   then raise exception 'Este programa no acepta nuevas inscripciones temporalmente'; end if;
 insert into public.loyalty_memberships(business_id,customer_id)
 values(p_business,auth.uid()) on conflict(business_id,customer_id) do nothing;
 select id into v_id from public.loyalty_memberships where business_id=p_business and customer_id=auth.uid();
 return v_id;
end; $$;

-- Webhooks verificados en API (firma Stripe). Además, acceso a la RPC solo
-- desde el rol service_role, nunca desde el navegador.
create table public.billing_webhook_events (
 stripe_event_id text primary key,
 business_id uuid not null references public.businesses(id) on delete cascade,
 received_at timestamptz not null default now()
);
alter table public.billing_webhook_events enable row level security;

create or replace function public.record_billing_event(
 p_event_id text,p_business uuid,p_customer text,p_subscription text,
 p_status text,p_event_created bigint
)
returns void language plpgsql security definer set search_path=public as $$
declare v_rows integer;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
   raise exception 'Solo el servidor puede registrar webhooks de facturación';
 end if;
 if p_status is not null and p_status not in
 ('trialing','active','past_due','canceled','unpaid','incomplete','incomplete_expired','paused') then
   raise exception 'Estado de Stripe no válido'; end if;
 if p_event_id is null or char_length(p_event_id)<5 or p_event_created<=0 then
   raise exception 'Evento inválido'; end if;
 insert into public.billing_webhook_events(stripe_event_id,business_id)
 values(p_event_id,p_business) on conflict(stripe_event_id) do nothing;
 get diagnostics v_rows=row_count;
 if v_rows=0 then return; end if;
 update public.business_billing
 set stripe_customer_id=coalesce(nullif(p_customer,''),stripe_customer_id),
     stripe_subscription_id=coalesce(nullif(p_subscription,''),stripe_subscription_id),
     status=case when p_status is not null and p_event_created>=last_stripe_event_created
                 then p_status else status end,
     last_stripe_event_created=case when p_status is not null
                                then greatest(last_stripe_event_created,p_event_created)
                                else last_stripe_event_created end,
     updated_at=now()
 where business_id=p_business;
 if not found then raise exception 'Negocio sin cuenta de facturación'; end if;
end; $$;
revoke execute on function public.record_billing_event(text,uuid,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.record_billing_event(text,uuid,text,text,text,bigint) to service_role;
