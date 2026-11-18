-- Suspensión comercial y slug bajo control de superadministración.
-- Un negocio puede editar su marca y datos, pero no levantar una suspensión.
create or replace function public.protect_business_admin_fields()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and not public.is_platform_admin() and
   (new.active is distinct from old.active or new.slug is distinct from old.slug) then
    raise exception 'Solo la superadministración puede cambiar el estado o el identificador del negocio';
  end if;
  return new;
end; $$;
create trigger business_admin_fields_guard before update of active,slug
on public.businesses for each row execute function public.protect_business_admin_fields();
