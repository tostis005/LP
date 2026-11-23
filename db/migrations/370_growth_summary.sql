-- KPIs comparables de clientes habituales, con ventana móvil de 90 días.
-- Habitual: 2 o más compras verificadas en los 90 días anteriores al corte
-- Y al menos 1 compra en el periodo analizado. Reversiones excluidas.
CREATE OR REPLACE FUNCTION public.business_growth_summary(p_business uuid,p_days integer)
RETURNS TABLE(metric text,current_value numeric,previous_value numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_days NOT IN (7,30,90) OR
 NOT (public.is_business_manager(p_business) OR public.is_platform_admin()) THEN
  RAISE EXCEPTION 'No autorizado o periodo inválido';
 END IF;
 RETURN QUERY
 WITH windows AS (
  SELECT 0 AS idx,now()-make_interval(days=>p_days) AS start_at,now() AS end_at
  UNION ALL
  SELECT 1,now()-make_interval(days=>2*p_days),now()-make_interval(days=>p_days)
 ), memberships AS (
  SELECT w.idx,t.membership_id,
   count(*) FILTER (WHERE t.created_at>=w.start_at)::numeric AS visits_current,
   count(*)::numeric AS visits_90,
   COALESCE(sum(t.amount_delta) FILTER (WHERE t.created_at>=w.start_at),0)::numeric AS units_current
  FROM windows w JOIN public.loyalty_transactions t
   ON t.business_id=p_business AND t.kind='earn'
   AND t.created_at>=w.end_at-interval '90 days' AND t.created_at<w.end_at
   AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=t.id)
  GROUP BY w.idx,t.membership_id
 ), totals AS (
  SELECT w.idx,
   count(m.membership_id) FILTER (WHERE m.visits_90>=2 AND m.visits_current>0)::numeric AS habitual,
   COALESCE(sum(m.units_current) FILTER (WHERE m.visits_90>=2 AND m.visits_current>0),0)::numeric AS units_habitual,
   COALESCE(sum(m.visits_current) FILTER (WHERE m.visits_90>=2 AND m.visits_current>0),0)::numeric AS visits_habitual,
   (SELECT count(*)::numeric FROM public.loyalty_memberships lm
     WHERE lm.business_id=p_business AND lm.created_at>=w.start_at AND lm.created_at<w.end_at) AS signup
  FROM windows w LEFT JOIN memberships m ON m.idx=w.idx
  GROUP BY w.idx,w.start_at,w.end_at
 ), values AS (
  SELECT idx,signup,habitual,
    CASE WHEN habitual=0 THEN 0 ELSE round(units_habitual/habitual,2) END AS avg_units,
    CASE WHEN habitual=0 THEN 0 ELSE round(visits_habitual/habitual,2) END AS avg_visits
  FROM totals
 )
 SELECT v.metric,
  max(v.value) FILTER(WHERE x.idx=0),
  max(v.value) FILTER(WHERE x.idx=1)
 FROM values x CROSS JOIN LATERAL (VALUES
  ('new_customers'::text,x.signup),
  ('habitual_customers'::text,x.habitual),
  ('avg_units_habitual'::text,x.avg_units),
  ('avg_visits_habitual'::text,x.avg_visits)
 ) v(metric,value)
 GROUP BY v.metric ORDER BY v.metric;
END $$;
REVOKE ALL ON FUNCTION public.business_growth_summary(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_growth_summary(uuid,integer) TO authenticated;
