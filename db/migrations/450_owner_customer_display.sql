-- Los nombres de clientes del historial y sus búsquedas utilizan únicamente el nombre visible.
CREATE OR REPLACE FUNCTION public.owner_customer_display_name(p_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN coalesce(a[1],'')='' THEN 'Cliente'
  WHEN coalesce(a[2],'')='' THEN a[1]
  ELSE a[1]||' '||upper(left(a[2],1))||'.' END
 FROM (SELECT regexp_split_to_array(btrim(regexp_replace(coalesce(p_name,''),'[[:space:]]*·[[:space:]]*Demo[[:space:]]*$','','i')),'[[:space:]]+') a) n;
$$;
REVOKE ALL ON FUNCTION public.owner_customer_display_name(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.owner_customer_display_name(text) TO authenticated,lp_api;
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
  public.owner_customer_display_name(c.raw_user_meta_data->>'full_name') AS customer_name,
  t.reversal_of,t.reversal_reason::text,
  EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=t.id) AS reversed,r.reward_label
 FROM public.loyalty_transactions t
 JOIN public.loyalty_memberships m ON m.id=t.membership_id AND m.business_id=p_business
 LEFT JOIN auth.users c ON c.id=m.customer_id LEFT JOIN auth.users e ON e.id=t.employee_id
 LEFT JOIN public.reward_redemptions r ON r.transaction_id=t.id AND r.business_id=p_business
 WHERE t.business_id=p_business
 AND (v_from IS NULL OR t.created_at>=v_from) AND (v_to IS NULL OR t.created_at<v_to)
 AND (p_employee IS NULL OR t.employee_id=p_employee) AND (p_kind IS NULL OR t.kind::text=p_kind)
 AND (p_search IS NULL OR strpos(lower(coalesce(t.ticket_ref,'')||' '||public.owner_customer_display_name(c.raw_user_meta_data->>'full_name')),lower(p_search))>0)
 )
 SELECT f.*,count(*) OVER() FROM filtered f ORDER BY f.created_at DESC,f.id DESC LIMIT p_limit OFFSET p_offset;
END $$;
REVOKE ALL ON FUNCTION public.business_owner_transactions(uuid,text,text,uuid,text,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_owner_transactions(uuid,text,text,uuid,text,text,integer,integer) TO authenticated,lp_api;

