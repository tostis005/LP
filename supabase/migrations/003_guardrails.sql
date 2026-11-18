-- Consistencia de saldos entre modalidades de fidelización
create or replace function public.prevent_program_type_change()
returns trigger language plpgsql set search_path=public as $$
begin
 if new.type is distinct from old.type and exists(
  select 1 from public.loyalty_memberships where business_id=old.business_id
 ) then
  raise exception 'No se puede cambiar el tipo de programa cuando hay tarjetas; requiere migración supervisada';
 end if;
 return new;
end; $$;
create trigger program_type_guard before update of type on public.loyalty_programs
for each row execute function public.prevent_program_type_change();
