-- Loyally: sucursales independientes, recompensas valoradas y analítica verificable.
-- Cada sucursal es un negocio autónomo con su tarjeta, permisos y datos.
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS parent_business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS businesses_parent_idx ON public.businesses(parent_business_id);

CREATE OR REPLACE FUNCTION public.manager_create_branch(
 p_source_business uuid,p_name text,p_slug text,p_owner_email text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_parent public.businesses%rowtype; v_id uuid; v_email text;
BEGIN
 IF NOT public.is_business_owner(p_source_business) AND NOT public.is_platform_admin()
 THEN RAISE EXCEPTION 'Solo el propietario del negocio principal puede crear sucursales'; END IF;
 SELECT * INTO v_parent FROM public.businesses WHERE id=p_source_business AND active FOR UPDATE;
 IF NOT FOUND OR v_parent.parent_business_id IS NOT NULL THEN
  RAISE EXCEPTION 'Selecciona un negocio principal activo para crear la sucursal'; END IF;
 IF (SELECT count(*) FROM public.businesses WHERE parent_business_id=p_source_business)>=50 THEN
  RAISE EXCEPTION 'Se ha alcanzado el límite de sucursales'; END IF;
 v_email:=lower(btrim(coalesce(p_owner_email,'')));
 IF char_length(btrim(coalesce(p_name,''))) NOT BETWEEN 2 AND 120
  OR coalesce(p_slug,'') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  OR v_email !~ '^[^ @]+@[^ @]+\.[^ @]+$' OR char_length(v_email)>254
 THEN RAISE EXCEPTION 'Revisa nombre, identificador y correo del propietario'; END IF;
 INSERT INTO public.businesses(
  name,slug,description,category,logo_url,accent_color,card_background,card_text,
  card_text_color,stamp_color,stamp_icon,stamp_image_url,parent_business_id,public_listing
 ) VALUES (
  btrim(p_name),p_slug,v_parent.description,v_parent.category,v_parent.logo_url,
  v_parent.accent_color,v_parent.card_background,v_parent.card_text,
  v_parent.card_text_color,v_parent.stamp_color,v_parent.stamp_icon,
  v_parent.stamp_image_url,p_source_business,false
 ) RETURNING id INTO v_id;
 INSERT INTO public.loyalty_programs(
  business_id,type,reward_label,reward_cost,cashback_bps,points_per_euro,
  max_stamps_per_action,max_ticket_cents,min_seconds_between_awards,
  max_daily_awards_per_employee,require_ticket_reference
 ) SELECT v_id,type,reward_label,reward_cost,cashback_bps,points_per_euro,
    max_stamps_per_action,max_ticket_cents,min_seconds_between_awards,
    max_daily_awards_per_employee,require_ticket_reference
   FROM public.loyalty_programs WHERE business_id=p_source_business;
 IF v_email=(SELECT lower(email) FROM auth.users WHERE id=auth.uid()) THEN
  INSERT INTO public.business_members(business_id,user_id,role)
   VALUES(v_id,auth.uid(),'owner');
 ELSE
  INSERT INTO public.business_invitations(business_id,email,role,invited_by)
   VALUES(v_id,v_email,'owner',auth.uid());
 END IF;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.manager_create_branch(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manager_create_branch(uuid,text,text,text) TO authenticated;

-- Solo los responsables ven los costes internos. Clientes/personal usan la función de opciones disponibles.
CREATE TABLE IF NOT EXISTS public.reward_options(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 label text NOT NULL CHECK(char_length(btrim(label)) BETWEEN 2 AND 120),
 retail_cents integer NOT NULL CHECK(retail_cents BETWEEN 0 AND 100000000),
 cost_cents integer NOT NULL CHECK(cost_cents BETWEEN 0 AND 100000000),
 active boolean NOT NULL DEFAULT true,
 position integer NOT NULL DEFAULT 0 CHECK(position BETWEEN 0 AND 9999),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reward_options_business_idx ON public.reward_options(business_id,active,position);
ALTER TABLE public.reward_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY reward_options_read ON public.reward_options FOR SELECT TO authenticated
 USING(public.is_business_manager(business_id) OR public.is_platform_admin());
CREATE POLICY reward_options_insert ON public.reward_options FOR INSERT TO authenticated
 WITH CHECK(public.is_business_manager(business_id) OR public.is_platform_admin());
CREATE POLICY reward_options_update ON public.reward_options FOR UPDATE TO authenticated
 USING(public.is_business_manager(business_id) OR public.is_platform_admin())
 WITH CHECK(public.is_business_manager(business_id) OR public.is_platform_admin());
CREATE POLICY reward_options_delete ON public.reward_options FOR DELETE TO authenticated
 USING(public.is_business_manager(business_id) OR public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.available_rewards(p_business uuid)
RETURNS TABLE(id uuid,label text,retail_cents integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT (public.is_business_staff(p_business) OR public.is_platform_admin()
  OR EXISTS(SELECT 1 FROM public.loyalty_memberships m WHERE m.business_id=p_business AND m.customer_id=auth.uid()))
 THEN RAISE EXCEPTION 'No autorizado'; END IF;
 RETURN QUERY SELECT o.id,o.label,o.retail_cents FROM public.reward_options o
  WHERE o.business_id=p_business AND o.active ORDER BY o.position,o.label;
END $$;
REVOKE ALL ON FUNCTION public.available_rewards(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.available_rewards(uuid) TO authenticated;

-- Histórico económico inmutable por canje, aun si se cambia el catálogo después.
CREATE TABLE IF NOT EXISTS public.reward_redemptions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 transaction_id uuid NOT NULL UNIQUE REFERENCES public.loyalty_transactions(id) ON DELETE CASCADE,
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 membership_id uuid NOT NULL REFERENCES public.loyalty_memberships(id) ON DELETE CASCADE,
 customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 reward_option_id uuid REFERENCES public.reward_options(id) ON DELETE SET NULL,
 reward_label text NOT NULL,
 retail_cents integer CHECK(retail_cents BETWEEN 0 AND 100000000),
 cost_cents integer CHECK(cost_cents BETWEEN 0 AND 100000000),
 redeemed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS redemptions_business_date_idx ON public.reward_redemptions(business_id,redeemed_at DESC);
CREATE INDEX IF NOT EXISTS redemptions_customer_date_idx ON public.reward_redemptions(customer_id,redeemed_at DESC);
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY reward_redemptions_manager_read ON public.reward_redemptions FOR SELECT TO authenticated
 USING(public.is_business_manager(business_id) OR public.is_platform_admin());
-- Ninguna escritura directa: la plataforma registra cada canje desde un trigger controlado.
CREATE OR REPLACE FUNCTION public.track_reward_redemption()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.kind='redeem' THEN
  INSERT INTO public.reward_redemptions(transaction_id,business_id,membership_id,customer_id,reward_label,redeemed_at)
  SELECT NEW.id,NEW.business_id,NEW.membership_id,m.customer_id,p.reward_label,NEW.created_at
  FROM public.loyalty_memberships m
  JOIN public.loyalty_programs p ON p.business_id=m.business_id
  WHERE m.id=NEW.membership_id;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_track_reward_redemption ON public.loyalty_transactions;
CREATE TRIGGER trg_track_reward_redemption AFTER INSERT ON public.loyalty_transactions
 FOR EACH ROW WHEN (NEW.kind='redeem') EXECUTE FUNCTION public.track_reward_redemption();

-- Retrocompatibilidad: los canjes anteriores no tienen coste/precio histórico verificable.
INSERT INTO public.reward_redemptions(transaction_id,business_id,membership_id,customer_id,reward_label,redeemed_at)
SELECT t.id,t.business_id,t.membership_id,m.customer_id,p.reward_label,t.created_at
FROM public.loyalty_transactions t
JOIN public.loyalty_memberships m ON m.id=t.membership_id
JOIN public.loyalty_programs p ON p.business_id=t.business_id
WHERE t.kind='redeem'
ON CONFLICT(transaction_id) DO NOTHING;

-- El cupón es validado por la función existente (un único uso y bloqueo de fila).
-- Solo después de un canje exitoso se fija la recompensa exacta elegida.
CREATE OR REPLACE FUNCTION public.staff_redeem_voucher_choice(p_token uuid,p_reward_option uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.reward_vouchers%rowtype; o public.reward_options%rowtype; v_balance integer; v_tx uuid;
BEGIN
 SELECT * INTO v FROM public.reward_vouchers WHERE token=p_token AND status='issued';
 IF NOT FOUND OR NOT public.is_business_staff(v.business_id) THEN RAISE EXCEPTION 'Cupón no disponible'; END IF;
 IF p_reward_option IS NOT NULL THEN
  SELECT * INTO o FROM public.reward_options WHERE id=p_reward_option AND business_id=v.business_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recompensa no disponible en esta sucursal'; END IF;
 ELSIF EXISTS(SELECT 1 FROM public.reward_options WHERE business_id=v.business_id AND active) THEN
  RAISE EXCEPTION 'Selecciona una de las recompensas disponibles';
 END IF;
 v_balance:=public.staff_redeem_voucher(p_token);
 SELECT t.id INTO v_tx FROM public.loyalty_transactions t
 WHERE t.membership_id=v.membership_id AND t.kind='redeem'
 ORDER BY t.created_at DESC,t.id DESC LIMIT 1;
 IF v_tx IS NULL THEN RAISE EXCEPTION 'No se pudo identificar el canje'; END IF;
 IF p_reward_option IS NOT NULL THEN
  UPDATE public.reward_redemptions SET reward_option_id=o.id,reward_label=o.label,
   retail_cents=o.retail_cents,cost_cents=o.cost_cents
  WHERE transaction_id=v_tx;
 END IF;
 RETURN v_balance;
END $$;
REVOKE ALL ON FUNCTION public.staff_redeem_voucher_choice(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_redeem_voucher_choice(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_redeem_card_choice(p_token uuid,p_cashback_cents integer,p_reward_option uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.loyalty_memberships%rowtype; o public.reward_options%rowtype; v_balance integer; v_tx uuid;
BEGIN
 SELECT * INTO m FROM public.loyalty_memberships WHERE card_token=p_token;
 IF NOT FOUND OR NOT public.is_business_staff(m.business_id) THEN RAISE EXCEPTION 'Tarjeta no disponible'; END IF;
 IF p_reward_option IS NOT NULL THEN
  SELECT * INTO o FROM public.reward_options WHERE id=p_reward_option AND business_id=m.business_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recompensa no disponible en esta sucursal'; END IF;
 ELSIF EXISTS(SELECT 1 FROM public.reward_options WHERE business_id=m.business_id AND active) THEN
  RAISE EXCEPTION 'Selecciona una de las recompensas disponibles';
 END IF;
 v_balance:=public.staff_redeem_card(p_token,p_cashback_cents);
 SELECT t.id INTO v_tx FROM public.loyalty_transactions t
 WHERE t.membership_id=m.id AND t.kind='redeem'
 ORDER BY t.created_at DESC,t.id DESC LIMIT 1;
 IF v_tx IS NULL THEN RAISE EXCEPTION 'No se pudo identificar el canje'; END IF;
 IF p_reward_option IS NOT NULL THEN
  UPDATE public.reward_redemptions SET reward_option_id=o.id,reward_label=o.label,
   retail_cents=o.retail_cents,cost_cents=o.cost_cents WHERE transaction_id=v_tx;
 END IF;
 RETURN v_balance;
END $$;
REVOKE ALL ON FUNCTION public.staff_redeem_card_choice(uuid,integer,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_redeem_card_choice(uuid,integer,uuid) TO authenticated;

-- Registrar importe de compras con sellos, sin cambiar reglas de autorización ni antfraude.
CREATE OR REPLACE FUNCTION public.staff_award_card(p_token uuid,p_purchase_cents integer DEFAULT 0,
 p_stamps integer DEFAULT 1,p_ticket_ref text DEFAULT null)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_m public.loyalty_memberships%rowtype; v_p public.loyalty_programs%rowtype;
 v_delta integer; v_ref text; v_last timestamptz;
BEGIN
 SELECT * INTO v_m FROM public.loyalty_memberships WHERE card_token=p_token FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tarjeta no encontrada'; END IF;
 IF NOT public.is_business_staff(v_m.business_id)
  OR NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=v_m.business_id AND active)
 THEN RAISE EXCEPTION 'Acceso denegado'; END IF;
 SELECT * INTO v_p FROM public.loyalty_programs WHERE business_id=v_m.business_id;
 SELECT max(created_at) INTO v_last FROM public.loyalty_transactions
  WHERE membership_id=v_m.id AND kind='earn';
 IF v_last IS NOT NULL AND v_last>now()-make_interval(secs=>v_p.min_seconds_between_awards)
 THEN RAISE EXCEPTION 'Espera antes de registrar otra compra en esta tarjeta'; END IF;
 IF p_purchase_cents<0 OR p_purchase_cents>v_p.max_ticket_cents
 THEN RAISE EXCEPTION 'Importe de compra fuera del límite'; END IF;
 IF v_p.require_ticket_reference AND nullif(btrim(coalesce(p_ticket_ref,'')),'') IS NULL
 THEN RAISE EXCEPTION 'Indica la referencia del ticket'; END IF;
 IF (SELECT count(*) FROM public.loyalty_transactions
     WHERE employee_id=auth.uid() AND kind='earn' AND business_id=v_m.business_id
      AND created_at >= date_trunc('day',now()))>=v_p.max_daily_awards_per_employee
 THEN RAISE EXCEPTION 'Límite diario de operaciones alcanzado'; END IF;
 IF v_p.type='stamps' THEN
  IF p_stamps<1 OR p_stamps>v_p.max_stamps_per_action THEN RAISE EXCEPTION 'Sellos fuera del límite'; END IF;
  v_delta:=p_stamps;
 ELSE
  IF p_purchase_cents<1 THEN RAISE EXCEPTION 'Indica un importe positivo'; END IF;
  v_delta:=CASE WHEN v_p.type='cashback'
   THEN floor(p_purchase_cents::numeric*v_p.cashback_bps/10000)::int
   ELSE floor(p_purchase_cents::numeric*v_p.points_per_euro/100)::int END;
  IF v_delta<1 THEN RAISE EXCEPTION 'Importe demasiado pequeño para generar saldo'; END IF;
 END IF;
 v_ref:=nullif(left(btrim(coalesce(p_ticket_ref,'')),100),'');
 INSERT INTO public.loyalty_transactions(business_id,membership_id,employee_id,kind,amount_delta,purchase_cents,ticket_ref)
 VALUES(v_m.business_id,v_m.id,auth.uid(),'earn',v_delta,
   nullif(p_purchase_cents,0),v_ref);
 UPDATE public.loyalty_memberships
  SET balance=balance+v_delta,total_earned=total_earned+v_delta WHERE id=v_m.id;
 RETURN v_m.balance+v_delta;
END $$;
REVOKE ALL ON FUNCTION public.staff_award_card(uuid,integer,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_award_card(uuid,integer,integer,text) TO authenticated;

-- Valoraciones: dos periodos consecutivos del mismo tamaño y misma sucursal.
CREATE OR REPLACE FUNCTION public.business_dashboard_metrics(p_business uuid,p_days integer)
RETURNS TABLE(metric text,current_value numeric,previous_value numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_days NOT BETWEEN 1 AND 365 OR
  NOT(public.is_business_manager(p_business) OR public.is_platform_admin())
 THEN RAISE EXCEPTION 'No autorizado o periodo inválido'; END IF;
 RETURN QUERY
 WITH periods AS (SELECT 0 AS idx UNION ALL SELECT 1),
 tx AS (
  SELECT t.* FROM public.loyalty_transactions t
   WHERE t.business_id=p_business AND t.kind IN ('earn','redeem')
    AND t.created_at >= now()-make_interval(days=>2*p_days)
    AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=t.id)
 ),
 tx_period AS (
  SELECT p.idx,
   count(t.id) FILTER(WHERE t.kind='earn')::numeric AS visits,
   count(t.id) FILTER(WHERE t.kind='redeem')::numeric AS redeems,
   count(DISTINCT t.membership_id) FILTER(WHERE t.kind='earn')::numeric AS buyers,
   coalesce(sum(t.purchase_cents) FILTER(WHERE t.kind='earn' AND t.purchase_cents>0),0)::numeric AS sales,
   count(t.id) FILTER(WHERE t.kind='earn' AND t.purchase_cents IS NULL)::numeric AS missing_sales
  FROM periods p LEFT JOIN tx t ON
   t.created_at>=now()-make_interval(days=>(p.idx+1)*p_days)
   AND t.created_at<now()-make_interval(days=>p.idx*p_days)
  GROUP BY p.idx
 ),
 member_period AS (
  SELECT p.idx,count(m.id)::numeric AS new_clients
   FROM periods p LEFT JOIN public.loyalty_memberships m ON
    m.business_id=p_business AND m.created_at>=now()-make_interval(days=>(p.idx+1)*p_days)
    AND m.created_at<now()-make_interval(days=>p.idx*p_days)
   GROUP BY p.idx
 ),
 reward_period AS (
  SELECT p.idx,coalesce(sum(r.cost_cents),0)::numeric AS costs,
   count(r.id) FILTER(WHERE r.cost_cents IS NULL)::numeric AS missing_costs
  FROM periods p LEFT JOIN public.reward_redemptions r
   ON r.business_id=p_business
    AND r.redeemed_at>=now()-make_interval(days=>(p.idx+1)*p_days)
    AND r.redeemed_at<now()-make_interval(days=>p.idx*p_days)
    AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=r.transaction_id)
   GROUP BY p.idx
 ),
 vals AS (
  SELECT p.idx,m.new_clients,t.visits,t.redeems,t.buyers,t.sales,t.missing_sales,
   r.costs,r.missing_costs,
   CASE WHEN t.buyers=0 THEN 0 ELSE round(t.visits/t.buyers,2) END AS frequency
  FROM periods p JOIN tx_period t ON t.idx=p.idx
   JOIN member_period m ON m.idx=p.idx JOIN reward_period r ON r.idx=p.idx
 )
 SELECT v.metric,
  max(CASE WHEN p.idx=0 THEN v.value END) AS current_value,
  max(CASE WHEN p.idx=1 THEN v.value END) AS previous_value
 FROM vals p CROSS JOIN LATERAL (VALUES
  ('new_customers',p.new_clients),('visits',p.visits),('redemptions',p.redeems),
  ('active_customers',p.buyers),('frequency',p.frequency),
  ('sales_cents',p.sales),('reward_cost_cents',p.costs),
  ('unpriced_purchases',p.missing_sales),('unpriced_rewards',p.missing_costs)
 ) v(metric,value)
 GROUP BY v.metric ORDER BY v.metric;
END $$;
REVOKE ALL ON FUNCTION public.business_dashboard_metrics(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_dashboard_metrics(uuid,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.business_reward_ranking(p_business uuid,p_days integer)
RETURNS TABLE(reward_label text,redemptions bigint,retail_cents bigint,cost_cents bigint,unpriced bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_days NOT BETWEEN 1 AND 365 OR
 NOT(public.is_business_manager(p_business) OR public.is_platform_admin())
 THEN RAISE EXCEPTION 'No autorizado'; END IF;
 RETURN QUERY
 SELECT r.reward_label,count(*)::bigint,
  coalesce(sum(r.retail_cents),0)::bigint,
  coalesce(sum(r.cost_cents),0)::bigint,
  count(*) FILTER(WHERE r.retail_cents IS NULL OR r.cost_cents IS NULL)::bigint
 FROM public.reward_redemptions r
 WHERE r.business_id=p_business AND r.redeemed_at>=now()-make_interval(days=>p_days)
 AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=r.transaction_id)
 GROUP BY r.reward_label ORDER BY count(*) DESC,r.reward_label LIMIT 30;
END $$;
REVOKE ALL ON FUNCTION public.business_reward_ranking(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_reward_ranking(uuid,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.customer_reward_summary()
RETURNS TABLE(benefits bigint,savings_cents bigint,unpriced bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Identifícate'; END IF;
 RETURN QUERY SELECT count(*)::bigint,coalesce(sum(r.retail_cents),0)::bigint,
  count(*) FILTER(WHERE r.retail_cents IS NULL)::bigint
 FROM public.reward_redemptions r WHERE r.customer_id=auth.uid()
 AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=r.transaction_id);
END $$;
REVOKE ALL ON FUNCTION public.customer_reward_summary() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.customer_reward_summary() TO authenticated;
