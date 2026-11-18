\echo '=== LP SQL integration smoke tests ==='
-- Datos ficticios: el trigger construye los perfiles automáticamente.
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin@example.test',now(),'{"full_name":"Admin"}'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','owner@example.test',now(),'{"full_name":"María Gerente"}'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','staff@example.test',now(),'{"full_name":"Alex Empleado"}'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','client@example.test',now(),'{"full_name":"Cliente Demo"}'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','other@example.test',now(),'{"full_name":"Otra Persona"}'),
 ('99999999-9999-4999-8999-999999999999','otherowner@example.test',now(),'{"full_name":"Otro Propietario"}');
insert into public.platform_admins(user_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select test.assert((select count(*)=6 from public.profiles),'trigger genera seis perfiles');

set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
select public.admin_create_business('Café Prueba','cafe-prueba','owner@example.test') as bid \gset
select set_config('test.business',:'bid',false);
select public.admin_create_business('Otro Negocio','otro-negocio','otherowner@example.test') as bid2 \gset
select set_config('test.business2',:'bid2',false);
select test.assert(public.is_platform_admin(),'superadmin reconocido');

-- El responsable reclama una invitación SOLO si su email está confirmado.
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
select test.assert(public.claim_invitations()=1,'responsable reclama invitación');
select test.assert(public.is_business_owner(current_setting('test.business')::uuid),'owner reconocido');
select public.invite_staff(current_setting('test.business')::uuid,'staff@example.test','employee');
update public.businesses set public_listing=true where id=current_setting('test.business')::uuid;
update public.loyalty_programs set min_seconds_between_awards=0,max_stamps_per_action=8
 where business_id=current_setting('test.business')::uuid;

-- Un empleado solo tiene permisos para el negocio que le invitó.
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
select test.assert(public.claim_invitations()=1,'empleado reclama invitación');
select test.assert(public.is_business_staff(current_setting('test.business')::uuid),'staff puede operar negocio asignado');
select test.assert(not public.is_business_staff(current_setting('test.business2')::uuid),'staff sin acceso a otro negocio');
select test.expect_error(
 'select public.admin_create_business(''Infiltrado'',''infiltrado'',''x@example.test'')',
 'No autorizado');

-- El cliente accede a un programa y obtiene un QR individual.
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',false);
select public.join_program(current_setting('test.business')::uuid) as mid \gset
select set_config('test.member',:'mid',false);
select card_token as tok from public.loyalty_memberships
 where id=current_setting('test.member')::uuid \gset
select set_config('test.token',:'tok',false);
select test.assert((select balance=0 from public.loyalty_memberships where id=current_setting('test.member')::uuid),'saldo inicial a cero');

-- Los clientes no pueden modificar su saldo directamente.
update public.loyalty_memberships set balance=999 where id=current_setting('test.member')::uuid;
select test.assert((select balance=0 from public.loyalty_memberships where id=current_setting('test.member')::uuid),'cliente no modifica saldo por RLS');
select test.expect_error(
 'select public.staff_award_card(current_setting(''test.token'')::uuid,0,1,''fake'')',
 'Acceso denegado');

-- La operación de empleado suma, registra actor y referencia.
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
select test.assert(
 (select count(*)=1 from public.staff_lookup_card(current_setting('test.token')::uuid)),
 'empleado autorizado puede consultar tarjeta');
select test.assert(public.staff_award_card(current_setting('test.token')::uuid,0,1,'T-001')=1,'sumar un sello');
select test.assert((select count(*)=1 from public.loyalty_transactions
 where ticket_ref='T-001' and employee_id=auth.uid()),'historial audita empleado y ticket');
select test.expect_error(
 'select public.staff_award_card(current_setting(''test.token'')::uuid,0,1,''T-001'')',
 'duplicate key');

-- Configuración de negocio: ticket obligatorio y máximo diario por empleado.
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
update public.loyalty_programs set require_ticket_reference=true,max_daily_awards_per_employee=2
 where business_id=current_setting('test.business')::uuid;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
select test.expect_error(
 'select public.staff_award_card(current_setting(''test.token'')::uuid,0,1,null)',
 'referencia');
select test.assert(public.staff_award_card(current_setting('test.token')::uuid,0,1,'T-002')=2,'segunda compra');
select test.expect_error(
 'select public.staff_award_card(current_setting(''test.token'')::uuid,0,1,''T-003'')',
 'máximo diario');
select test.assert((select balance=2 from public.loyalty_memberships where id=current_setting('test.member')::uuid),
 'límite diario no altera el saldo');

-- Solo un manager revierte; la reversión exige motivo y una sola vez.
select id as transaction_id from public.loyalty_transactions where ticket_ref='T-001' \gset
select set_config('test.transaction',:'transaction_id',false);
select test.expect_error(
 'select public.manager_reverse_transaction(current_setting(''test.transaction'')::uuid,''Motivo suficientemente largo'')',
 'Solo un responsable');
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
select test.assert(public.manager_reverse_transaction(current_setting('test.transaction')::uuid,
 'Error de escaneo confirmado')=1,'manager revierte compra');
select test.assert((select balance=1 and total_earned=1 from public.loyalty_memberships
 where id=current_setting('test.member')::uuid),'saldos coherentes tras reversión');
select test.expect_error(
 'select public.manager_reverse_transaction(current_setting(''test.transaction'')::uuid,''Otra corrección repetida'')',
 'ya se ha revertido');
select test.assert((select count(*)=1 from public.loyalty_transactions
 where reversal_of=current_setting('test.transaction')::uuid),'solo una corrección registrada');

-- El usuario ajeno no puede leer tarjetas ni operar negocio de terceros.
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',false);
select test.assert((select count(*)=0 from public.loyalty_memberships
 where business_id=current_setting('test.business')::uuid),'aislamiento RLS cliente ajeno');
select test.assert((select count(*)=0 from public.staff_lookup_card(current_setting('test.token')::uuid)),
 'lookup no revela tarjeta a usuarios ajenos');
select test.expect_error(
 'select * from public.business_customer_directory(current_setting(''test.business'')::uuid)',
 'No autorizado');

-- Un programa no puede cambiar de unidad si ya emitió tarjetas.
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
select test.expect_error(
 'update public.loyalty_programs set type=''points'' where business_id=current_setting(''test.business'')::uuid',
 'No se puede cambiar');

-- Suspender un negocio es exclusivo de superadmin.
select test.expect_error(
 'update public.businesses set active=false where id=current_setting(''test.business'')::uuid',
 'Solo la superadministración');
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
update public.businesses set active=false where id=current_setting('test.business')::uuid;
select test.assert((select not active from public.businesses where id=current_setting('test.business')::uuid),
 'superadmin suspende negocio');
-- Validación de altas, estados y eventos de Stripe (sin cobros reales).
reset role;
select test.assert((select billing_enforced=false from public.platform_billing_settings where id),'cobros desactivados por defecto');
select test.assert((select count(*)=2 from public.business_billing),'cuenta de facturación automática por negocio');
set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false);
select test.expect_error(
 'select public.record_billing_event(''evt_fake_123'',current_setting(''test.business2'')::uuid,null,null,''active'',1234)',
 'permission denied');
reset role;
set role service_role;
select set_config('request.jwt.claim.role','service_role',false);
select public.record_billing_event('evt_first_123',current_setting('test.business2')::uuid,'cus_demo','sub_demo','active',1234);
select public.record_billing_event('evt_first_123',current_setting('test.business2')::uuid,'cus_demo','sub_demo','past_due',1234);
reset role;
select test.assert((select status='active' from public.business_billing
 where business_id=current_setting('test.business2')::uuid),'reintento de webhook idempotente');
update public.platform_billing_settings set billing_enforced=true where id;
update public.business_billing set status='past_due' where business_id=current_setting('test.business2')::uuid;
set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',false);
select test.expect_error(
 'select public.join_program(current_setting(''test.business2'')::uuid)',
 'no acepta nuevas inscripciones');
reset role;
\echo '=== LP SQL integration: OK ==='
