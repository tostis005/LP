-- Link de inscripción directo, incluso para negocios que deciden no aparecer en el mapa.
-- Se muestran solo datos públicos del programa, no datos privados de usuarios.
create or replace function public.find_join_business(p_slug text)
returns table(business_id uuid,business_name text,description text,accent_color text,reward_label text,program_type text)
language plpgsql stable security definer set search_path=public as $$
begin
 return query select b.id,b.name,b.description,b.accent_color,p.reward_label,p.type
 from public.businesses b join public.loyalty_programs p on p.business_id=b.id
 where b.slug=p_slug and b.active;
end; $$;
revoke execute on function public.find_join_business(text) from public;
grant execute on function public.find_join_business(text) to anon,authenticated;
-- La URL privada del negocio permite unirse aunque el negocio no figure en directorio.
create or replace function public.join_program(p_business uuid) returns uuid language plpgsql security definer
set search_path=public as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Identifícate para unirte'; end if;
 if not exists(select 1 from public.businesses where id=p_business and active)
   then raise exception 'Programa no disponible'; end if;
 insert into public.loyalty_memberships(business_id,customer_id)
 values(p_business,auth.uid()) on conflict(business_id,customer_id) do nothing;
 select id into v_id from public.loyalty_memberships where business_id=p_business and customer_id=auth.uid();
 return v_id;
end; $$;
revoke execute on function public.join_program(uuid) from public,anon;
grant execute on function public.join_program(uuid) to authenticated;
