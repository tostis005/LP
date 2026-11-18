-- LP: reversión auditable y controles adicionales contra errores/fraude.
-- Solo gerentes/superadministradores pueden revertir; nunca se borran movimientos.
alter table public.loyalty_programs
  add column if not exists max_daily_awards_per_employee integer not null default 100
    check (max_daily_awards_per_employee between 1 and 250),
  add column if not exists require_ticket_reference boolean not null default false;

alter table public.loyalty_transactions
  drop constraint if exists loyalty_transactions_kind_check;
alter table public.loyalty_transactions
  add constraint loyalty_transactions_kind_check
  check (kind in ('earn','redeem','reversal'));
alter table public.loyalty_transactions
  add column if not exists reversal_of uuid references public.loyalty_transactions(id),
  add column if not exists reversal_reason text;

create unique index if not exists one_reversal_per_transaction
  on public.loyalty_transactions(reversal_of) where reversal_of is not null;
create index if not exists loyalty_transactions_employee_created
  on public.loyalty_transactions(business_id,employee_id,created_at desc)
  where kind='earn';

-- Límite por empleado y negocio, comprobado en servidor y serializado por
-- bloqueo asesor de transacción para evitar saltarse el cupo con concurrencia.
create or replace function public.guard_loyalty_award()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_limit integer; v_require boolean; v_count bigint; v_start timestamptz;
begin
 if new.kind <> 'earn' then return new; end if;
 if auth.uid() is null or new.employee_id is distinct from auth.uid() then
   raise exception 'El empleado no coincide con la sesión';
 end if;
 if not public.is_business_staff(new.business_id) then
   raise exception 'El usuario no pertenece a este negocio';
 end if;
 select max_daily_awards_per_employee,require_ticket_reference
 into v_limit,v_require
 from public.loyalty_programs where business_id=new.business_id;
 if not found then raise exception 'Programa inexistente'; end if;
 if v_require and nullif(btrim(coalesce(new.ticket_ref,'')),'') is null then
   raise exception 'Este negocio requiere la referencia del ticket';
 end if;
 perform pg_advisory_xact_lock(hashtext(new.business_id::text),hashtext(new.employee_id::text));
 v_start:=date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
 select count(*) into v_count from public.loyalty_transactions
  where business_id=new.business_id and employee_id=new.employee_id
    and kind='earn' and created_at>=v_start;
 if v_count>=v_limit then
   raise exception 'Se ha alcanzado el máximo diario de operaciones de este empleado';
 end if;
 return new;
end; $$;
create trigger guard_award before insert on public.loyalty_transactions
  for each row execute function public.guard_loyalty_award();

create or replace function public.manager_reverse_transaction(p_transaction uuid,p_reason text)
returns integer language plpgsql security definer set search_path=public as $$
declare
 v_orig public.loyalty_transactions%rowtype;
 v_member public.loyalty_memberships%rowtype;
 v_delta integer;
begin
 if auth.uid() is null then raise exception 'No autorizado'; end if;
 if char_length(btrim(coalesce(p_reason,'')))<8 or char_length(p_reason)>300 then
   raise exception 'Indica un motivo de 8 a 300 caracteres';
 end if;
 select * into v_orig from public.loyalty_transactions
 where id=p_transaction and kind in ('earn','redeem') for update;
 if not found then raise exception 'No se puede revertir esta operación'; end if;
 if not (public.is_business_manager(v_orig.business_id) or public.is_platform_admin()) then
   raise exception 'Solo un responsable puede revertir movimientos';
 end if;
 if not public.is_platform_admin() and v_orig.created_at<now()-interval '72 hours' then
   raise exception 'Han pasado más de 72 horas. Contacta con administración';
 end if;
 if exists(select 1 from public.loyalty_transactions where reversal_of=p_transaction) then
   raise exception 'Esta operación ya se ha revertido';
 end if;
 select * into v_member from public.loyalty_memberships
 where id=v_orig.membership_id for update;
 if not found then raise exception 'Tarjeta no encontrada'; end if;
 v_delta:=-v_orig.amount_delta;
 if v_member.balance+v_delta<0 then
   raise exception 'No se puede revertir: el saldo restante es insuficiente';
 end if;
 insert into public.loyalty_transactions
  (business_id,membership_id,employee_id,kind,amount_delta,reversal_of,reversal_reason)
 values(v_orig.business_id,v_orig.membership_id,auth.uid(),'reversal',v_delta,
        p_transaction,btrim(p_reason));
 update public.loyalty_memberships
 set balance=balance+v_delta,
 total_earned=case when v_orig.kind='earn' then total_earned-v_orig.amount_delta
                    else total_earned end
 where id=v_orig.membership_id;
 return v_member.balance+v_delta;
end; $$;
revoke execute on function public.manager_reverse_transaction(uuid,text) from public,anon;
grant execute on function public.manager_reverse_transaction(uuid,text) to authenticated;

-- Consulta agregada completa para el panel, sin exponer empleados de otros negocios.
create or replace function public.business_employee_activity(p_business uuid,p_days integer default 30)
returns table(user_id uuid,employee_name text,operations bigint,awarded_units bigint)
language plpgsql stable security definer set search_path=public as $$
begin
 if p_days not between 1 and 365 then raise exception 'Rango de días no válido'; end if;
 if not (public.is_business_manager(p_business) or public.is_platform_admin()) then
   raise exception 'No autorizado';
 end if;
 return query
 select t.employee_id,coalesce(nullif(p.full_name,''),'Empleado')::text,
        count(*)::bigint,coalesce(sum(t.amount_delta),0)::bigint
 from public.loyalty_transactions t
 left join public.profiles p on p.id=t.employee_id
 where t.business_id=p_business and t.kind='earn'
  and t.created_at>=now()-make_interval(days=>p_days)
 group by t.employee_id,p.full_name
 order by count(*) desc;
end; $$;
revoke execute on function public.business_employee_activity(uuid,integer) from public,anon;
grant execute on function public.business_employee_activity(uuid,integer) to authenticated;
