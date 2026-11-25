-- Monetary tracking is opt-in for stamps; points and cashback already need a purchase amount.
ALTER TABLE public.loyalty_programs ADD COLUMN IF NOT EXISTS require_purchase_amount boolean NOT NULL DEFAULT false;
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
 IF (v_p.require_purchase_amount OR v_p.type<>'stamps') AND coalesce(p_purchase_cents,0)<1 THEN RAISE EXCEPTION 'Indica el importe de la compra'; END IF;
 IF coalesce(p_purchase_cents,0)<0 OR p_purchase_cents>v_p.max_ticket_cents
 THEN RAISE EXCEPTION 'Importe de compra fuera del límite'; END IF;
 IF v_p.require_ticket_reference AND nullif(btrim(coalesce(p_ticket_ref,'')),'') IS NULL
 THEN RAISE EXCEPTION 'Indica la referencia del ticket'; END IF;
 IF (SELECT count(*) FROM public.loyalty_transactions
     WHERE employee_id=auth.uid() AND kind='earn' AND business_id=v_m.business_id
      AND created_at >= date_trunc('day',now()))>=v_p.max_daily_awards_per_employee
 THEN RAISE EXCEPTION 'Límite diario de operaciones alcanzado'; END IF;
 IF v_p.type='stamps' THEN
  IF p_stamps IS NULL OR p_stamps<1 OR p_stamps>v_p.max_stamps_per_action THEN RAISE EXCEPTION 'Sellos fuera del límite'; END IF;
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


-- Default reward cost is manager-only; never expose it in public program records.
CREATE TABLE IF NOT EXISTS public.program_reward_costs(
 business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
 cost_cents integer CHECK(cost_cents BETWEEN 0 AND 100000000)
);
ALTER TABLE public.program_reward_costs ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.business_default_reward_cost(p_business uuid)
RETURNS TABLE(cost_cents integer) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $fin$
BEGIN
 IF NOT(public.is_business_manager(p_business) OR public.is_platform_admin()) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 RETURN QUERY SELECT r.cost_cents FROM public.program_reward_costs r WHERE r.business_id=p_business;
END $fin$;
CREATE OR REPLACE FUNCTION public.business_save_default_reward_cost(p_business uuid,p_cost integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fin$
BEGIN
 IF NOT(public.is_business_manager(p_business) OR public.is_platform_admin()) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 INSERT INTO public.program_reward_costs(business_id,cost_cents) VALUES(p_business,p_cost)
 ON CONFLICT(business_id) DO UPDATE SET cost_cents=excluded.cost_cents;
 RETURN true;
END $fin$;
CREATE OR REPLACE FUNCTION public.track_reward_redemption()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fin$
BEGIN
 IF NEW.kind='redeem' THEN
  INSERT INTO public.reward_redemptions(transaction_id,business_id,membership_id,customer_id,reward_label,redeemed_at,cost_cents)
  SELECT NEW.id,NEW.business_id,NEW.membership_id,m.customer_id,p.reward_label,NEW.created_at,
   CASE WHEN p.type='cashback' THEN abs(NEW.amount_delta) ELSE c.cost_cents END
  FROM public.loyalty_memberships m JOIN public.loyalty_programs p ON p.business_id=m.business_id
  LEFT JOIN public.program_reward_costs c ON c.business_id=m.business_id WHERE m.id=NEW.membership_id;
 END IF;
 RETURN NEW;
END $fin$;
-- A customer sees only their own history, never the internal cost or staff personal details.
CREATE OR REPLACE FUNCTION public.customer_card_history(p_membership uuid,p_limit integer,p_offset integer)
RETURNS TABLE(id uuid,kind text,amount_delta integer,created_at timestamptz,reversed boolean,reward_label text,purchase_cents integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $fin$
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset<0 OR
 NOT EXISTS(SELECT 1 FROM public.loyalty_memberships m WHERE m.id=p_membership AND m.customer_id=auth.uid())
 THEN RAISE EXCEPTION 'No autorizado o paginación inválida'; END IF;
 RETURN QUERY SELECT t.id,t.kind::text,t.amount_delta,t.created_at,
 EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=t.id),r.reward_label,t.purchase_cents
 FROM public.loyalty_transactions t LEFT JOIN public.reward_redemptions r ON r.transaction_id=t.id
 WHERE t.membership_id=p_membership ORDER BY t.created_at DESC,t.id DESC LIMIT p_limit OFFSET p_offset;
END $fin$;
-- Historical amounts are aggregated independently to avoid multiplying transactions by rewards.
CREATE OR REPLACE FUNCTION public.business_customer_financials(p_business uuid)
RETURNS TABLE(user_id uuid,sales_cents bigint,priced_purchases bigint,unpriced_purchases bigint,reward_cost_cents bigint,priced_rewards bigint,unpriced_rewards bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $fin$
BEGIN
 IF NOT(public.is_business_manager(p_business) OR public.is_platform_admin()) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.loyalty_programs p WHERE p.business_id=p_business AND (p.require_purchase_amount OR p.type<>'stamps')) THEN RETURN; END IF;
 RETURN QUERY
 WITH purchases AS (
 SELECT t.membership_id,coalesce(sum(t.purchase_cents),0)::bigint AS sales,
 count(*) FILTER(WHERE t.purchase_cents IS NOT NULL) AS priced,count(*) FILTER(WHERE t.purchase_cents IS NULL) AS missing
 FROM public.loyalty_transactions t WHERE t.business_id=p_business AND t.kind='earn'
 AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=t.id) GROUP BY t.membership_id
 ), rewards AS (
 SELECT r.membership_id,coalesce(sum(r.cost_cents),0)::bigint AS costs,
 count(*) FILTER(WHERE r.cost_cents IS NOT NULL) AS priced,count(*) FILTER(WHERE r.cost_cents IS NULL) AS missing
 FROM public.reward_redemptions r WHERE r.business_id=p_business
 AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=r.transaction_id) GROUP BY r.membership_id
 )
 SELECT m.customer_id,coalesce(p.sales,0),coalesce(p.priced,0),coalesce(p.missing,0),coalesce(r.costs,0),coalesce(r.priced,0),coalesce(r.missing,0)
 FROM public.loyalty_memberships m LEFT JOIN purchases p ON p.membership_id=m.id LEFT JOIN rewards r ON r.membership_id=m.id WHERE m.business_id=p_business;
END $fin$;
REVOKE ALL ON FUNCTION public.business_default_reward_cost(uuid),public.business_save_default_reward_cost(uuid,integer),public.customer_card_history(uuid,integer,integer),public.business_customer_financials(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_default_reward_cost(uuid),public.business_save_default_reward_cost(uuid,integer),public.customer_card_history(uuid,integer,integer),public.business_customer_financials(uuid) TO authenticated,lp_api;
CREATE INDEX IF NOT EXISTS loyalty_transactions_member_history_idx ON public.loyalty_transactions(membership_id,created_at DESC,id DESC);

-- Ranking completeness concerns internal cost, not optional retail valuation.
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
  count(*) FILTER(WHERE r.cost_cents IS NULL)::bigint
 FROM public.reward_redemptions r
 WHERE r.business_id=p_business AND r.redeemed_at>=now()-make_interval(days=>p_days)
 AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=r.transaction_id)
 GROUP BY r.reward_label ORDER BY count(*) DESC,r.reward_label LIMIT 30;
END $$;
REVOKE ALL ON FUNCTION public.business_reward_ranking(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_reward_ranking(uuid,integer) TO authenticated;

