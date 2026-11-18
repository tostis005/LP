-- Supabase concede privilegios de objetos al rol authenticated, después
-- las políticas RLS imponen límites. Este bootstrap emula ese comportamiento.
grant usage on schema public,auth,storage,test to authenticated,anon;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;
grant execute on function test.assert(boolean,text),test.expect_error(text,text) to authenticated;
grant select,insert,update,delete on storage.objects to authenticated;

grant usage on schema public,auth,storage,test to service_role;
grant select on all tables in schema public to service_role;
