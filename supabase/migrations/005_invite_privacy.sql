-- Los correos de invitaciones solo se consultan desde perfiles de gestión.
-- Quien recibe una invitación la reclama por una función que verifica su email;
-- no necesita que la invitación sea visible mediante una consulta directa.
drop policy if exists invites_read on public.business_invitations;
create policy invites_read on public.business_invitations for select to authenticated
 using (public.is_business_manager(business_id) or (select public.is_platform_admin()));
