-- Datos del propietario: todas las consultas están limitadas al negocio autorizado.
CREATE OR REPLACE FUNCTION public.business_owner_activity(p_business uuid,p_days integer)
RETURNS TABLE(user_id uuid,employee_name text,operations bigint,awarded_units bigint,redemptions bigint,sales_cents bigint,priced_operations bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_days IS NULL OR p_days NOT IN (7,30,90) OR NOT (public.is_business_manager(p_business) OR public.is_platform_admin()) THEN
  RAISE EXCEPTION 'No autorizado o periodo inválido';
 END IF;
 RETURN QUERY SELECT t.employee_id,
  coalesce(nullif(u.raw_user_meta_data->>'full_name',''),'Empleado')::text,
  count(*) FILTER(WHERE t.kind='earn')::bigint,
  coalesce(sum(t.amount_delta) FILTER(WHERE t.kind='earn'),0)::bigint,
  count(*) FILTER(WHERE t.kind='redeem')::bigint,
  coalesce(sum(t.purchase_cents) FILTER(WHERE t.kind='earn'),0)::bigint,
  count(*) FILTER(WHERE t.kind='earn' AND t.purchase_cents IS NOT NULL)::bigint
 FROM public.loyalty_transactions t LEFT JOIN auth.users u ON u.id=t.employee_id
 WHERE t.business_id=p_business AND t.employee_id IS NOT NULL AND t.kind IN ('earn','redeem')
 AND t.created_at>=now()-make_interval(days=>p_days) AND t.created_at<=now()
 AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions r WHERE r.reversal_of=t.id)
 GROUP BY t.employee_id,u.raw_user_meta_data->>'full_name' ORDER BY 3 DESC,2;
END $$;
REVOKE ALL ON FUNCTION public.business_owner_activity(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_owner_activity(uuid,integer) TO authenticated,lp_api;

CREATE OR REPLACE FUNCTION public.business_owner_transactions(
 p_business uuid,p_from text,p_to text,p_employee uuid,p_kind text,p_search text,p_limit integer,p_offset integer
)
RETURNS TABLE(id uuid,kind text,amount_delta integer,purchase_cents integer,ticket_ref text,created_at timestamptz,
 employee_id uuid,employee_name text,customer_name text,reversal_of uuid,reversal_reason text,reversed boolean,reward_label text,total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_from timestamptz; v_to timestamptz;
BEGIN
 IF NOT (public.is_business_manager(p_business) OR public.is_platform_admin()) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 IF p_kind IS NOT NULL AND p_kind NOT IN ('earn','redeem','reversal') THEN RAISE EXCEPTION 'Tipo de operación inválido'; END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 250 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 200000000
  OR length(coalesce(p_search,''))>120 THEN RAISE EXCEPTION 'Filtros inválidos'; END IF;
 v_from:=nullif(p_from,'')::timestamptz;v_to:=nullif(p_to,'')::timestamptz;
 IF v_from IS NOT NULL AND v_to IS NOT NULL AND v_from>=v_to THEN RAISE EXCEPTION 'Fechas inválidas'; END IF;
 RETURN QUERY
 WITH filtered AS (
 SELECT t.id,t.kind::text AS kind,t.amount_delta::integer,t.purchase_cents::integer,t.ticket_ref::text,t.created_at,
  t.employee_id,coalesce(nullif(e.raw_user_meta_data->>'full_name',''),'Empleado')::text AS employee_name,
  coalesce(nullif(c.raw_user_meta_data->>'full_name',''),'Sin nombre')::text AS customer_name,
  t.reversal_of,t.reversal_reason::text,
  EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=t.id) AS reversed,r.reward_label
 FROM public.loyalty_transactions t
 JOIN public.loyalty_memberships m ON m.id=t.membership_id AND m.business_id=p_business
 LEFT JOIN auth.users c ON c.id=m.customer_id LEFT JOIN auth.users e ON e.id=t.employee_id
 LEFT JOIN public.reward_redemptions r ON r.transaction_id=t.id AND r.business_id=p_business
 WHERE t.business_id=p_business
 AND (v_from IS NULL OR t.created_at>=v_from) AND (v_to IS NULL OR t.created_at<v_to)
 AND (p_employee IS NULL OR t.employee_id=p_employee) AND (p_kind IS NULL OR t.kind::text=p_kind)
 AND (p_search IS NULL OR strpos(lower(coalesce(t.ticket_ref,'')||' '||coalesce(c.raw_user_meta_data->>'full_name','')),lower(p_search))>0)
 )
 SELECT f.*,count(*) OVER() FROM filtered f ORDER BY f.created_at DESC,f.id DESC LIMIT p_limit OFFSET p_offset;
END $$;
REVOKE ALL ON FUNCTION public.business_owner_transactions(uuid,text,text,uuid,text,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_owner_transactions(uuid,text,text,uuid,text,text,integer,integer) TO authenticated,lp_api;

CREATE OR REPLACE FUNCTION public.business_owner_customer_activity(p_business uuid)
RETURNS TABLE(user_id uuid,last_visit timestamptz,period_visits bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT (public.is_business_manager(p_business) OR public.is_platform_admin()) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 RETURN QUERY SELECT m.customer_id,max(t.created_at),count(t.id) FILTER(WHERE t.created_at>=now()-interval '30 days')::bigint
 FROM public.loyalty_memberships m LEFT JOIN public.loyalty_transactions t
 ON t.membership_id=m.id AND t.business_id=p_business AND t.kind='earn'
 AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions r WHERE r.reversal_of=t.id)
 WHERE m.business_id=p_business GROUP BY m.customer_id;
END $$;
REVOKE ALL ON FUNCTION public.business_owner_customer_activity(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_owner_customer_activity(uuid) TO authenticated,lp_api;

-- Datos de muestra: solo el establecimiento interno y cuentas de ejemplo sin login.
-- Se conservan los importes, fechas, saldos, identificadores y movimientos reales.
CREATE OR REPLACE FUNCTION public.seed_internal_noma_dashboard()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 v_business uuid;v_user uuid;v_option uuid;v_staff uuid[]:=ARRAY[]::uuid[];v_options uuid[]:=ARRAY[]::uuid[];
 v_names text[]:=ARRAY['Laura','Daniel','Sofía','Pablo','Marta','Álex'];
 v_rewards text[]:=ARRAY['Café latte','Cappuccino','Flat white','Americano'];
BEGIN
 SELECT b.id INTO v_business FROM public.businesses b JOIN public.loyalty_programs p ON p.business_id=b.id
 WHERE b.slug='interno-cafe-noma' AND b.name='Café Noma' AND p.type='stamps' LIMIT 1;
 IF v_business IS NULL THEN RETURN; END IF;
 FOR i IN 1..6 LOOP
  v_user:=md5(v_business::text||':noma-dashboard-staff:'||i)::uuid;
  INSERT INTO auth.users(id,email,password_hash,raw_user_meta_data)
  VALUES(v_user,'cafe-noma-personal-'||i||'@example.invalid','disabled-demo-account-'||md5(v_user::text),
    jsonb_build_object('full_name',v_names[i]||' · Demo')) ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.business_members(business_id,user_id,role,active)
   VALUES(v_business,v_user,'employee',true) ON CONFLICT(business_id,user_id) DO NOTHING;
  v_staff:=array_append(v_staff,v_user);
 END LOOP;
 FOR i IN 1..4 LOOP
  SELECT o.id INTO v_option FROM public.reward_options o WHERE o.business_id=v_business AND o.label=v_rewards[i] ORDER BY o.created_at LIMIT 1;
  IF v_option IS NULL THEN
   v_option:=md5(v_business::text||':noma-dashboard-reward:'||i)::uuid;
   INSERT INTO public.reward_options(id,business_id,label,retail_cents,cost_cents,active,position)
   VALUES(v_option,v_business,v_rewards[i],0,0,true,i) ON CONFLICT(id) DO NOTHING;
  END IF;
  v_options:=array_append(v_options,v_option);
 END LOOP;
 -- Atribuir los movimientos de alta inicial exclusivamente a empleados ficticios.
 -- Las compras de caja posteriores a la demo no se modifican.
 UPDATE public.loyalty_transactions t SET employee_id=v_staff[CASE
  WHEN mod(abs(hashtext(t.id::text)::bigint),100)<28 THEN 1
  WHEN mod(abs(hashtext(t.id::text)::bigint),100)<50 THEN 2
  WHEN mod(abs(hashtext(t.id::text)::bigint),100)<68 THEN 3
  WHEN mod(abs(hashtext(t.id::text)::bigint),100)<82 THEN 4
  WHEN mod(abs(hashtext(t.id::text)::bigint),100)<93 THEN 5 ELSE 6 END]
 FROM public.loyalty_memberships m JOIN auth.users u ON u.id=m.customer_id
 WHERE t.business_id=v_business AND t.membership_id=m.id
 AND u.email LIKE 'cafe-noma-ejemplo-%@example.invalid'
 AND t.kind='earn' AND t.ticket_ref LIKE 'NOMA-163-%'
 AND NOT(t.employee_id=ANY(v_staff));
 -- Solo canjes iniciales asociados temporalmente a una compra de la semilla.
 UPDATE public.loyalty_transactions t SET employee_id=e.employee_id
 FROM public.loyalty_transactions e
 WHERE t.business_id=v_business AND e.business_id=v_business AND t.membership_id=e.membership_id
 AND t.kind='redeem' AND e.kind='earn' AND e.ticket_ref LIKE 'NOMA-163-%'
 AND t.created_at=e.created_at+interval '3 minutes' AND e.employee_id=ANY(v_staff)
 AND NOT(t.employee_id=ANY(v_staff));
 UPDATE public.reward_redemptions r SET
 reward_option_id=v_options[CASE
  WHEN mod(abs(hashtext(r.transaction_id::text)::bigint),100)<44 THEN 1
  WHEN mod(abs(hashtext(r.transaction_id::text)::bigint),100)<70 THEN 2
  WHEN mod(abs(hashtext(r.transaction_id::text)::bigint),100)<88 THEN 3 ELSE 4 END],
 reward_label=v_rewards[CASE
  WHEN mod(abs(hashtext(r.transaction_id::text)::bigint),100)<44 THEN 1
  WHEN mod(abs(hashtext(r.transaction_id::text)::bigint),100)<70 THEN 2
  WHEN mod(abs(hashtext(r.transaction_id::text)::bigint),100)<88 THEN 3 ELSE 4 END]
 FROM public.loyalty_transactions t JOIN public.loyalty_memberships m ON m.id=t.membership_id
 JOIN auth.users u ON u.id=m.customer_id
 WHERE r.business_id=v_business AND r.transaction_id=t.id AND t.employee_id=ANY(v_staff)
 AND u.email LIKE 'cafe-noma-ejemplo-%@example.invalid' AND r.reward_option_id IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.seed_internal_noma_dashboard() FROM PUBLIC,anon,authenticated,lp_api,lp_auth;
SELECT public.seed_internal_noma_dashboard();
