-- Separación real entre el dueño de la DEMO y el administrador global.
-- El aprovisionador creó los negocios internos con prefijo "interno-".
-- Solo se corrigen las asignaciones del usuario DEMO conocido.
DELETE FROM public.business_members bm
USING auth.users u,public.businesses b
WHERE bm.user_id=u.id AND bm.business_id=b.id
 AND lower(u.email)='gestor@loyally.local'
 AND bm.role='owner'
 AND b.slug LIKE 'interno-%'
 AND b.slug<>'interno-cafe-noma';

-- La cuenta de administración mantiene acceso a los negocios desde /admin,
-- sin conceder esos permisos al perfil del dueño.
-- Muestra determinista e idempotente; no borra membresías existentes.
CREATE OR REPLACE FUNCTION public.seed_internal_noma_to_163()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 v_business uuid; v_employee uuid; v_program public.loyalty_programs%rowtype;
 v_id uuid; v_membership uuid; v_existing integer; v_inserted integer:=0;
 v_total integer; v_balance integer; v_units integer; v_visits integer;
 v_age integer; v_at timestamptz; v_original_claim text;
 v_names text[]:=ARRAY['Lucía','Martín','Raúl','Elena','Sofía','Mateo','Clara',
  'Diego','María','Hugo','Valeria','Pablo','Inés','Carmen','Andrés','Paula',
  'Adrián','Nora','Javier','Marta','Leo','Julia','Sara','Iván','Alba',
  'Daniel','Olivia','Bruno','Ana','Alonso'];
 v_surnames text[]:=ARRAY['García','Ruiz','Torres','López','Sánchez',
  'Navarro','Vega','Romero','Ortiz','Ríos','Molina','Reyes','Soto',
  'Álvarez','Pérez','León','Gil','Cruz','Herrera','Morales'];
BEGIN
 SELECT b.id INTO v_business FROM public.businesses b
 WHERE b.slug='interno-cafe-noma' AND b.name='Café Noma'
 AND b.active LIMIT 1;
 IF v_business IS NULL THEN
  RAISE NOTICE 'Café Noma interno no está disponible: sin datos de muestra';
  RETURN 0;
 END IF;
 SELECT * INTO v_program FROM public.loyalty_programs p WHERE p.business_id=v_business;
 IF NOT FOUND OR v_program.type<>'stamps' THEN
  RAISE NOTICE 'El programa de Café Noma no es de sellos';
  RETURN 0;
 END IF;
 SELECT bm.user_id INTO v_employee FROM public.business_members bm
 JOIN auth.users u ON u.id=bm.user_id
 WHERE bm.business_id=v_business AND bm.active AND bm.role IN ('employee','owner','manager')
 ORDER BY CASE bm.role WHEN 'employee' THEN 0 WHEN 'owner' THEN 1 ELSE 2 END,bm.created_at
 LIMIT 1;
 IF v_employee IS NULL THEN
  RAISE NOTICE 'Café Noma no tiene personal asignado';
  RETURN 0;
 END IF;
 SELECT count(*) INTO v_existing FROM public.loyalty_memberships
 WHERE business_id=v_business;
 v_original_claim:=current_setting('request.jwt.claim.sub',true);
 -- Numeración estable con IDs derivados del negocio. Las cuentas ficticias
 -- no tienen confirmación ni contraseña scrypt válida.
 FOR i IN 1..200 LOOP
  EXIT WHEN v_existing>=163;
  v_id:=md5(v_business::text||':noma-sample-163-v1:'||i::text)::uuid;
  INSERT INTO auth.users(id,email,password_hash,raw_user_meta_data)
  VALUES(v_id,'cafe-noma-ejemplo-'||lpad(i::text,3,'0')||'@example.invalid',
   'demo-disabled-'||md5(v_id::text),
   jsonb_build_object('full_name',
    v_names[1+mod(i-1,array_length(v_names,1))]||' '||
    v_surnames[1+mod(i*7,array_length(v_surnames,1))]||' · Demo'))
  ON CONFLICT(id) DO NOTHING;
  v_age:=CASE WHEN i>115 THEN (i*7)%28+1 ELSE (i*13)%125+30 END;
  INSERT INTO public.loyalty_memberships(business_id,customer_id,created_at)
  VALUES(v_business,v_id,now()-make_interval(days=>v_age))
  ON CONFLICT(business_id,customer_id) DO NOTHING RETURNING id INTO v_membership;
  IF v_membership IS NULL THEN CONTINUE; END IF;
  v_existing:=v_existing+1;
  v_inserted:=v_inserted+1;
  v_balance:=0;v_total:=0;
  v_visits:=CASE WHEN mod(i,7)=0 THEN 0 WHEN mod(i,11)=0 THEN 1
    ELSE 2+mod(i*17,11) END;
  PERFORM set_config('request.jwt.claim.sub',v_employee::text,true);
  FOR j IN 1..v_visits LOOP
   v_units:=LEAST(v_program.max_stamps_per_action,
    CASE WHEN mod(i+j,6)=0 THEN 2 ELSE 1 END);
   v_units:=GREATEST(1,v_units);
   -- Distribución temporal realista entre alta y fecha actual.
   v_at:=now()-((v_age-(j::numeric/(v_visits+1))*(v_age-0.25))*interval '1 day');
   INSERT INTO public.loyalty_transactions(
     business_id,membership_id,employee_id,kind,amount_delta,
     purchase_cents,ticket_ref,created_at)
   VALUES(v_business,v_membership,v_employee,'earn',v_units,
     (43+mod(i*23+j*37,139))*100,
     'NOMA-163-'||lpad(i::text,3,'0')||'-'||lpad(j::text,2,'0'),v_at);
   v_total:=v_total+v_units;v_balance:=v_balance+v_units;
   IF v_balance>=v_program.reward_cost AND mod(i,4)<>0 THEN
    INSERT INTO public.loyalty_transactions(
     business_id,membership_id,employee_id,kind,amount_delta,created_at)
    VALUES(v_business,v_membership,v_employee,'redeem',
      -v_program.reward_cost,v_at+interval '3 minutes');
    v_balance:=v_balance-v_program.reward_cost;
   END IF;
  END LOOP;
  UPDATE public.loyalty_memberships
   SET balance=v_balance,total_earned=v_total WHERE id=v_membership;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub',coalesce(v_original_claim,''),true);
 RAISE NOTICE 'Café Noma: % nuevas tarjetas de demostración; total %',
  v_inserted,v_existing;
 RETURN v_inserted;
END $$;
REVOKE ALL ON FUNCTION public.seed_internal_noma_to_163() FROM PUBLIC,anon,authenticated,lp_api,lp_auth;
SELECT public.seed_internal_noma_to_163();
