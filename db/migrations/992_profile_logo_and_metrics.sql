ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date CHECK(birth_date >= DATE '1900-01-01' AND birth_date <= CURRENT_DATE);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender text CHECK(gender IN ('man','woman','other'));
-- Existing accounts are not assigned invented dates. The customer UI requires completion.
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS card_logo_scale integer NOT NULL DEFAULT 100 CHECK(card_logo_scale BETWEEN 50 AND 220);
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS card_logo_x integer NOT NULL DEFAULT 0 CHECK(card_logo_x BETWEEN -50 AND 50);
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS card_logo_y integer NOT NULL DEFAULT 0 CHECK(card_logo_y BETWEEN -50 AND 50);
DROP FUNCTION IF EXISTS public.public_business_card_assets(text);
CREATE FUNCTION public.public_business_card_assets(p_slug text) RETURNS TABLE(card_background text,stamp_image_url text,card_logo_scale integer,card_logo_x integer,card_logo_y integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT b.card_background,b.stamp_image_url,b.card_logo_scale,b.card_logo_x,b.card_logo_y FROM public.businesses b JOIN public.loyalty_programs p ON p.business_id=b.id WHERE b.slug=p_slug AND b.active LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.public_business_card_assets(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_business_card_assets(text) TO anon,authenticated;
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
   coalesce(sum(t.amount_delta) FILTER(WHERE t.kind='earn'),0)::numeric AS awarded_units,
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
  SELECT p.idx,m.new_clients,t.visits,t.awarded_units,t.redeems,t.buyers,t.sales,t.missing_sales,
   r.costs,r.missing_costs,
   CASE WHEN t.buyers=0 THEN 0 ELSE round(t.visits/t.buyers,2) END AS frequency
  FROM periods p JOIN tx_period t ON t.idx=p.idx
   JOIN member_period m ON m.idx=p.idx JOIN reward_period r ON r.idx=p.idx
 )
 SELECT v.metric,
  max(CASE WHEN p.idx=0 THEN v.value END) AS current_value,
  max(CASE WHEN p.idx=1 THEN v.value END) AS previous_value
 FROM vals p CROSS JOIN LATERAL (VALUES
  ('new_customers',p.new_clients),('visits',p.visits),('awarded_units',p.awarded_units),('redemptions',p.redeems),
  ('active_customers',p.buyers),('frequency',p.frequency),
  ('sales_cents',p.sales),('reward_cost_cents',p.costs),
  ('unpriced_purchases',p.missing_sales),('unpriced_rewards',p.missing_costs)
 ) v(metric,value)
 GROUP BY v.metric ORDER BY v.metric;
END $$;
REVOKE ALL ON FUNCTION public.business_dashboard_metrics(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_dashboard_metrics(uuid,integer) TO authenticated;

