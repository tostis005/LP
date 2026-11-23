-- Actividad de muestra, únicamente para el establecimiento ficticio Café Noma.
-- No modifica clientes reales ni asigna permisos de propietario a otros negocios.
-- Los correos .invalid no se pueden utilizar para iniciar sesión ni recibir emails.
CREATE OR REPLACE FUNCTION public.seed_cafe_noma_demo_activity()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 v_business uuid; v_worker uuid; v_type text;v_cost integer;v_max integer;
 v_user uuid;v_member uuid;v_total integer;v_balance integer;v_award integer;
 v_visits integer;v_age integer;v_time timestamptz;v_tx uuid;v_inserted integer:=0;
 v_old_claim text;
 v_names text[]:=ARRAY[
  'Lucía Martín · Demo','Raúl Pérez · Demo','Elena Ruiz · Demo',
  'Mario Salas · Demo','Sofía Torres · Demo','Daniel Ortega · Demo',
  'Inés Romero · Demo','Hugo Martín · Demo','Paula García · Demo',
  'Diego Navarro · Demo','Laura Gil · Demo','Sara Ríos · Demo',
  'Andrés Vega · Demo','Alicia León · Demo','Marta Cruz · Demo',
  'Iván López · Demo','Nora Díaz · Demo','Clara Mena · Demo',
  'Pablo Lara · Demo','Julia Flores · Demo'
 ];
 v_ages integer[]:=ARRAY[112,101,94,86,79,72,65,58,51,46,40,34,29,24,19,16,12,9,5,2];
 v_counts integer[]:=ARRAY[12,11,10,9,8,7,7,6,5,5,4,4,3,3,2,2,1,1,0,0];
BEGIN
 SELECT b.id,p.type,p.reward_cost,p.max_stamps_per_action
 INTO v_business,v_type,v_cost,v_max
 FROM public.businesses b JOIN public.loyalty_programs p ON p.business_id=b.id
 WHERE b.slug='cafe-noma' AND b.name='Café Noma'
 LIMIT 1;
 IF v_business IS NULL OR v_type<>'stamps' THEN RETURN 0; END IF;
 SELECT bm.user_id INTO v_worker
 FROM public.business_members bm
 JOIN auth.users u ON u.id=bm.user_id
 WHERE bm.business_id=v_business AND bm.active AND bm.role IN ('owner','manager','employee')
 ORDER BY CASE bm.role WHEN 'employee' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END,bm.created_at
 LIMIT 1;
 IF v_worker IS NULL THEN RETURN 0; END IF;
 v_old_claim:=current_setting('request.jwt.claim.sub',true);
 PERFORM set_config('request.jwt.claim.sub',v_worker::text,true);
 FOR i IN 1..array_length(v_names,1) LOOP
  v_user:=md5(v_business::text||':demo-noma-v1:'||i::text)::uuid;
  INSERT INTO auth.users(id,email,password_hash,raw_user_meta_data)
  VALUES(v_user,'noma-demo-'||lpad(i::text,2,'0')||'@example.invalid',
   'disabled-demo-account-'||md5(v_user::text),
   jsonb_build_object('full_name',v_names[i]))
  ON CONFLICT(id) DO NOTHING;
  -- Los registros demo no tienen consentimiento de marketing.
  -- No se inventan suscripciones push, teléfonos ni datos bancarios.
  INSERT INTO public.loyalty_memberships(business_id,customer_id,created_at)
  VALUES(v_business,v_user,now()-make_interval(days=>v_ages[i]))
  ON CONFLICT(business_id,customer_id) DO NOTHING RETURNING id INTO v_member;
  IF v_member IS NULL THEN CONTINUE; END IF;
  v_inserted:=v_inserted+1;
  v_total:=0;v_balance:=0;v_visits:=v_counts[i]; 
  FOR j IN 1..v_visits LOOP
   v_award:=LEAST(GREATEST(v_max,1),CASE WHEN mod(i+j,5)=0 THEN 2 ELSE 1 END);
   v_time:=now()-(
      (v_ages[i]-j*((v_ages[i]-0.45)::double precision/(v_visits+1)))
      *interval '1 day'
   );
   INSERT INTO public.loyalty_transactions(
     business_id,membership_id,employee_id,kind,amount_delta,
     purchase_cents,ticket_ref,created_at)
   VALUES(v_business,v_member,v_worker,'earn',v_award,
      (45+((i*17+j*29)%125))*100,
      'NOMA-DEMO-'||lpad(i::text,2,'0')||'-'||lpad(j::text,2,'0'),v_time);
   v_total:=v_total+v_award;v_balance:=v_balance+v_award;
   -- Algunos usuarios han canjeado su primer premio: cuadrar saldo e historial.
   IF v_cost>0 AND v_balance>=v_cost AND mod(i,3)<>0 THEN
    INSERT INTO public.loyalty_transactions(
      business_id,membership_id,employee_id,kind,amount_delta,created_at)
    VALUES(v_business,v_member,v_worker,'redeem',-v_cost,v_time+interval '4 minutes');
    v_balance:=v_balance-v_cost;
   END IF;
  END LOOP;
  UPDATE public.loyalty_memberships SET total_earned=v_total,balance=v_balance
  WHERE id=v_member;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub',coalesce(v_old_claim,''),true);
 RETURN v_inserted;
END $$;
REVOKE ALL ON FUNCTION public.seed_cafe_noma_demo_activity() FROM PUBLIC,anon,authenticated,lp_api,lp_auth;
-- Se ejecuta una única vez cuando se aplica la migración a la base.
SELECT public.seed_cafe_noma_demo_activity();

-- El usuario administrador de la demo puede administrar todos los negocios
-- desde el panel global, pero su selector de propietario solo muestra Café Noma.
DELETE FROM public.business_members bm
USING auth.users u,public.businesses b
WHERE bm.user_id=u.id AND bm.business_id=b.id
 AND u.email='admin@demo.loyally.test' AND bm.role='owner'
 AND b.slug IN ('brunch-club','barba-norte','studio-verde','taco-lumbre',
  'pan-mar','dulce-frontera','punto-fit','lavanda-spa','marea-pets')
 AND EXISTS(SELECT 1 FROM public.platform_admins pa WHERE pa.user_id=u.id);
