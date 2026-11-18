-- Solicitudes comerciales: el alta de negocios sigue reservada al superadmin.
create table public.business_leads(
 id uuid primary key default gen_random_uuid(),
 business_name text not null check (char_length(btrim(business_name)) between 2 and 120),
 contact_name text not null check (char_length(btrim(contact_name)) between 2 and 120),
 contact_email text not null check (char_length(contact_email) between 5 and 254),
 category text,
 city text not null check (char_length(btrim(city)) between 2 and 120),
 message text check (char_length(coalesce(message,''))<=1000),
 consent_contact boolean not null check (consent_contact=true),
 status text not null default 'new'
  check (status in ('new','contacted','converted','archived')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index business_leads_email_recent_idx
 on public.business_leads(lower(contact_email),created_at desc);
alter table public.business_leads enable row level security;
create policy business_leads_admin_read on public.business_leads for select to authenticated
 using ((select public.is_platform_admin()));
create policy business_leads_admin_update on public.business_leads for update to authenticated
 using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));

-- Rechaza envíos duplicados del mismo correo durante 24h; transaccional.
create or replace function public.guard_lead_duplicates()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtext(lower(new.contact_email)));
 if exists(select 1 from public.business_leads
   where lower(contact_email)=lower(new.contact_email)
    and created_at>now()-interval '24 hours') then
    raise exception 'Solicitud ya registrada para este correo en las últimas 24 horas';
 end if;
 new.contact_email=lower(btrim(new.contact_email));
 new.business_name=btrim(new.business_name);
 new.contact_name=btrim(new.contact_name);
 new.city=btrim(new.city);
 return new;
end; $$;
create trigger guard_lead before insert on public.business_leads
 for each row execute function public.guard_lead_duplicates();

-- Convertir una solicitud en negocio + invitación en una sola transacción.
create or replace function public.admin_convert_lead(p_lead uuid,p_slug text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_lead public.business_leads%rowtype; v_business uuid;
begin
 if not public.is_platform_admin() then raise exception 'No autorizado'; end if;
 select * into v_lead from public.business_leads where id=p_lead for update;
 if not found then raise exception 'Solicitud no encontrada'; end if;
 if v_lead.status='converted' then raise exception 'Solicitud ya convertida'; end if;
 v_business:=public.admin_create_business(v_lead.business_name,p_slug,v_lead.contact_email);
 update public.business_leads set status='converted',updated_at=now() where id=p_lead;
 return v_business;
end; $$;
revoke execute on function public.admin_convert_lead(uuid,text) from public,anon;
grant execute on function public.admin_convert_lead(uuid,text) to authenticated;
