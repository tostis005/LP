-- Consultas de directorio expuestas SOLO a roles autorizados.
create or replace function public.business_customer_directory(p_business uuid)
returns table(user_id uuid,full_name text,email text,balance integer,total_earned integer,visits bigint,marketing_ok boolean,joined_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
 if not (public.is_business_manager(p_business) or public.is_platform_admin()) then raise exception 'No autorizado'; end if;
 return query
 select m.customer_id,p.full_name,u.email::text,m.balance,m.total_earned,
 (select count(*) from public.loyalty_transactions t where t.membership_id=m.id and t.kind='earn') as visits,
 coalesce(c.opted_in,false) as marketing_ok,m.created_at
 from public.loyalty_memberships m join public.profiles p on p.id=m.customer_id
 join auth.users u on u.id=m.customer_id
 left join public.marketing_consents c on c.customer_id=m.customer_id and c.business_id=p_business
 where m.business_id=p_business order by m.created_at desc;
end; $$;
create or replace function public.business_staff_directory(p_business uuid)
returns table(user_id uuid,full_name text,email text,role text,active boolean)
language plpgsql stable security definer set search_path=public as $$
begin
 if not (public.is_business_manager(p_business) or public.is_platform_admin()) then raise exception 'No autorizado'; end if;
 return query select m.user_id,p.full_name,u.email::text,m.role,m.active from public.business_members m
 join auth.users u on u.id=m.user_id
 join public.profiles p on p.id=m.user_id where m.business_id=p_business order by m.created_at;
end; $$;
create or replace function public.admin_user_directory()
returns table(user_id uuid,full_name text,email text,businesses bigint,joined_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
 if not public.is_platform_admin() then raise exception 'No autorizado'; end if;
 return query select u.id,p.full_name,u.email::text,
 (select count(*) from public.loyalty_memberships m where m.customer_id=u.id),u.created_at
 from auth.users u left join public.profiles p on p.id=u.id order by u.created_at desc;
end; $$;
revoke execute on function public.business_customer_directory(uuid) from public,anon;
revoke execute on function public.business_staff_directory(uuid) from public,anon;
revoke execute on function public.admin_user_directory() from public,anon;
grant execute on function public.business_customer_directory(uuid) to authenticated;
grant execute on function public.business_staff_directory(uuid) to authenticated;
grant execute on function public.admin_user_directory() to authenticated;
