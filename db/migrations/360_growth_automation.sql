-- Crecimiento útil, automatizaciones por evento y privacidad en caja.
-- La fuente de visitas es exclusivamente 'earn' no revertido; nunca el saldo acumulado.
CREATE OR REPLACE FUNCTION public.business_growth_series(p_business uuid,p_days integer)
RETURNS TABLE(bucket_start date,new_customers bigint,habitual_customers bigint,awarded_units bigint,
 average_units numeric,verified_visits bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_step integer;
BEGIN
 IF p_days NOT IN (7,30,90) OR
  NOT (public.is_business_manager(p_business) OR public.is_platform_admin()) THEN
  RAISE EXCEPTION 'No autorizado o periodo inválido';
 END IF;
 v_step:=CASE p_days WHEN 7 THEN 1 WHEN 30 THEN 5 ELSE 15 END;
 RETURN QUERY
 WITH periods AS (
  SELECT (CURRENT_DATE-p_days+g*v_step)::date AS start_at,
    LEAST((CURRENT_DATE-p_days+(g+1)*v_step)::timestamptz,now()) AS end_at
  FROM generate_series(0,p_days/v_step-1) g
 ), per_customer AS (
  SELECT d.start_at,d.end_at,t.membership_id,
   count(*) FILTER (WHERE t.created_at>=d.start_at)::bigint AS recent_visits,
   COALESCE(sum(t.amount_delta) FILTER (WHERE t.created_at>=d.start_at),0)::bigint AS recent_units,
   count(t.id)::bigint AS visits_90
  FROM periods d
  JOIN public.loyalty_transactions t ON t.business_id=p_business AND t.kind='earn'
   AND t.created_at>=d.end_at-interval '90 days' AND t.created_at<d.end_at
   AND NOT EXISTS (SELECT 1 FROM public.loyalty_transactions reversal WHERE reversal.reversal_of=t.id)
  GROUP BY d.start_at,d.end_at,t.membership_id
 )
 SELECT d.start_at,
  (SELECT count(*)::bigint FROM public.loyalty_memberships m
   WHERE m.business_id=p_business AND m.created_at>=d.start_at AND m.created_at<d.end_at),
  count(pc.membership_id) FILTER(WHERE pc.visits_90>=2 AND pc.recent_visits>0)::bigint,
  COALESCE(sum(pc.recent_units) FILTER(WHERE pc.visits_90>=2 AND pc.recent_visits>0),0)::bigint,
  COALESCE(round(
    COALESCE(sum(pc.recent_units) FILTER(WHERE pc.visits_90>=2 AND pc.recent_visits>0),0)::numeric
    /NULLIF(count(pc.membership_id) FILTER(WHERE pc.visits_90>=2 AND pc.recent_visits>0),0),2),0),
  COALESCE(sum(pc.recent_visits),0)::bigint
 FROM periods d LEFT JOIN per_customer pc ON pc.start_at=d.start_at
 GROUP BY d.start_at,d.end_at ORDER BY d.start_at;
END $$;
REVOKE ALL ON FUNCTION public.business_growth_series(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_growth_series(uuid,integer) TO authenticated;

-- Reglas activadas por el responsable. Ninguna modifica automáticamente el saldo
-- ni concede premios: la recompensa especial se confirma por el personal en caja.
CREATE TABLE IF NOT EXISTS public.automation_rules(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 offer_id uuid NOT NULL UNIQUE REFERENCES public.business_offers(id) ON DELETE RESTRICT,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 3 AND 70),
 trigger_kind text NOT NULL CHECK(trigger_kind IN ('signup','stamps')),
 delay_days integer NOT NULL DEFAULT 0 CHECK(delay_days BETWEEN 0 AND 90),
 target_stamps integer CHECK(target_stamps BETWEEN 1 AND 100),
 window_days integer CHECK(window_days BETWEEN 1 AND 365),
 staff_instruction text NOT NULL DEFAULT '' CHECK(length(staff_instruction)<=250),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT automation_rule_fields CHECK(
  (trigger_kind='signup' AND target_stamps IS NULL AND window_days IS NULL AND staff_instruction='')
  OR (trigger_kind='stamps' AND target_stamps IS NOT NULL AND window_days IS NOT NULL)
 )
);
CREATE INDEX IF NOT EXISTS automation_rules_business_idx ON public.automation_rules(business_id,active);
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS automation_rules_manager_select ON public.automation_rules;
CREATE POLICY automation_rules_manager_select ON public.automation_rules FOR SELECT TO authenticated
 USING(public.is_business_manager(business_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS automation_rules_manager_insert ON public.automation_rules;
CREATE POLICY automation_rules_manager_insert ON public.automation_rules FOR INSERT TO authenticated
 WITH CHECK(public.is_business_manager(business_id) AND created_by=auth.uid());
DROP POLICY IF EXISTS automation_rules_manager_update ON public.automation_rules;
CREATE POLICY automation_rules_manager_update ON public.automation_rules FOR UPDATE TO authenticated
 USING(public.is_business_manager(business_id)) WITH CHECK(public.is_business_manager(business_id));
REVOKE ALL ON public.automation_rules FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE ON public.automation_rules TO authenticated;

-- Cola privada, idempotente por tarjeta y regla.
CREATE TABLE IF NOT EXISTS public.automation_queue(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 rule_id uuid NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
 membership_id uuid NOT NULL REFERENCES public.loyalty_memberships(id) ON DELETE CASCADE,
 due_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','delivered','skipped')),
 processed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(rule_id,membership_id)
);
CREATE INDEX IF NOT EXISTS automation_queue_due_idx ON public.automation_queue(due_at)
 WHERE status='pending';
ALTER TABLE public.automation_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_queue FROM PUBLIC,anon,authenticated;

-- Encolar al crear la tarjeta; la autorización para recibir avisos se verifica
-- únicamente en el momento de entrega, tras guardar el consentimiento.
CREATE OR REPLACE FUNCTION public.enqueue_signup_automation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.automation_queue(rule_id,membership_id,due_at)
 SELECT r.id,NEW.id,NEW.created_at+make_interval(days=>r.delay_days)
 FROM public.automation_rules r
 WHERE r.business_id=NEW.business_id AND r.active AND r.trigger_kind='signup'
 ON CONFLICT(rule_id,membership_id) DO NOTHING;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS automation_on_membership_created ON public.loyalty_memberships;
CREATE TRIGGER automation_on_membership_created AFTER INSERT ON public.loyalty_memberships
 FOR EACH ROW EXECUTE FUNCTION public.enqueue_signup_automation();
REVOKE ALL ON FUNCTION public.enqueue_signup_automation() FROM PUBLIC,anon,authenticated;

-- Umbral sobre sellos realmente obtenidos (no sobre saldo, que se reduce en canjes).
-- El límite de días es relativo al alta de la tarjeta y se aplica en servidor.
CREATE OR REPLACE FUNCTION public.enqueue_stamp_automation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.total_earned<=OLD.total_earned OR NEW.total_earned<=0 THEN RETURN NEW; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.loyalty_programs p
  WHERE p.business_id=NEW.business_id AND p.type='stamps') THEN RETURN NEW; END IF;
 INSERT INTO public.automation_queue(rule_id,membership_id,due_at)
 SELECT r.id,NEW.id,now()+make_interval(days=>r.delay_days)
 FROM public.automation_rules r
 WHERE r.business_id=NEW.business_id AND r.active AND r.trigger_kind='stamps'
  AND OLD.total_earned<r.target_stamps AND NEW.total_earned>=r.target_stamps
  AND now()<=NEW.created_at+make_interval(days=>r.window_days)
 ON CONFLICT(rule_id,membership_id) DO NOTHING;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS automation_on_stamps_earned ON public.loyalty_memberships;
CREATE TRIGGER automation_on_stamps_earned AFTER UPDATE OF total_earned ON public.loyalty_memberships
 FOR EACH ROW EXECUTE FUNCTION public.enqueue_stamp_automation();
REVOKE ALL ON FUNCTION public.enqueue_stamp_automation() FROM PUBLIC,anon,authenticated;

-- Procesamiento por lotes seguro, sin destinatarios expuestos al dueño.
-- Un aviso va a la bandeja personal solo si existe consentimiento vigente.
CREATE OR REPLACE FUNCTION public.dispatch_due_automations(p_limit integer DEFAULT 100)
RETURNS TABLE(delivered integer,skipped integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_delivered integer:=0; v_skipped integer:=0; v_ok boolean;
 v_job record;
BEGIN
 IF p_limit NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Límite incorrecto'; END IF;
 FOR v_job IN
  SELECT q.id,q.membership_id,r.offer_id,r.active,r.business_id,
   m.customer_id,b.active AS business_active
  FROM public.automation_queue q
  JOIN public.automation_rules r ON r.id=q.rule_id
  JOIN public.loyalty_memberships m ON m.id=q.membership_id
  JOIN public.businesses b ON b.id=r.business_id
  WHERE q.status='pending' AND q.due_at<=now()
  ORDER BY q.due_at,q.id
  LIMIT p_limit FOR UPDATE OF q SKIP LOCKED
 LOOP
  SELECT v_job.active AND v_job.business_active AND EXISTS(
   SELECT 1 FROM public.marketing_consents c
   WHERE c.business_id=v_job.business_id AND c.customer_id=v_job.customer_id
   AND (c.opted_in OR c.push_opted_in OR c.whatsapp_opted_in)
  ) INTO v_ok;
  IF v_ok THEN
   INSERT INTO public.offer_receipts(offer_id,customer_id)
   VALUES(v_job.offer_id,v_job.customer_id)
   ON CONFLICT(offer_id,customer_id) DO NOTHING;
   v_delivered:=v_delivered+1;
  ELSE
   v_skipped:=v_skipped+1;
  END IF;
  UPDATE public.automation_queue SET status=CASE WHEN v_ok THEN 'delivered' ELSE 'skipped' END,
    processed_at=now() WHERE id=v_job.id;
 END LOOP;
 RETURN QUERY SELECT v_delivered,v_skipped;
END $$;
REVOKE ALL ON FUNCTION public.dispatch_due_automations(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_due_automations(integer) TO lp_auth;

-- Caja: la consulta revela solo nombre abreviado, fecha de alta, visitas y
-- una instrucción activa del negocio. Nunca email, apellidos ni contacto.
CREATE OR REPLACE FUNCTION public.staff_card_context(p_membership uuid)
RETURNS TABLE(customer_label text,joined_at timestamptz,verified_visits bigint,
 staff_notes jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 RETURN QUERY
 SELECT
  CASE WHEN nullif(btrim(coalesce(p.full_name,'')),'') IS NULL THEN 'Cliente'::text ELSE
   (split_part(btrim(p.full_name),' ',1) ||
    CASE WHEN split_part(btrim(p.full_name),' ',2)<>'' THEN
     ' '||upper(left(split_part(btrim(p.full_name),' ',2),1))||'.' ELSE '' END)::text
  END,
  m.created_at,
  (SELECT count(*) FROM public.loyalty_transactions t
   WHERE t.membership_id=m.id AND t.kind='earn'
   AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=t.id)),
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'name',r.name,'target',r.target_stamps,'expires_at',m.created_at+make_interval(days=>r.window_days),
    'instruction',r.staff_instruction
   ) ORDER BY r.target_stamps)
   FROM public.automation_rules r
   WHERE r.business_id=m.business_id AND r.active AND r.trigger_kind='stamps'
    AND r.staff_instruction<>'' AND now()<=m.created_at+make_interval(days=>r.window_days)
    AND EXISTS(SELECT 1 FROM public.loyalty_programs pr WHERE pr.business_id=m.business_id AND pr.type='stamps')
  ),'[]'::jsonb)
 FROM public.loyalty_memberships m JOIN public.profiles p ON p.id=m.customer_id
 WHERE m.id=p_membership AND public.is_business_staff(m.business_id)
 AND EXISTS(SELECT 1 FROM public.businesses b WHERE b.id=m.business_id AND b.active);
END $$;
REVOKE ALL ON FUNCTION public.staff_card_context(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_card_context(uuid) TO authenticated;

-- Sólo el personal autorizado puede consultar el alias; el nombre completo
-- deja de salir incluso en la respuesta de las búsquedas QR.
CREATE OR REPLACE FUNCTION public.staff_lookup_card(p_token uuid)
RETURNS TABLE(membership_id uuid,business_id uuid,business_name text,customer_name text,
 program_type text,balance integer,reward_label text,reward_cost integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 RETURN QUERY SELECT m.id,b.id,b.name,
  CASE WHEN nullif(btrim(coalesce(p.full_name,'')),'') IS NULL THEN 'Cliente'::text ELSE
   (split_part(btrim(p.full_name),' ',1)||
    CASE WHEN split_part(btrim(p.full_name),' ',2)<>'' THEN
     ' '||upper(left(split_part(btrim(p.full_name),' ',2),1))||'.' ELSE '' END)::text END,
  pr.type,m.balance,pr.reward_label,pr.reward_cost
 FROM public.loyalty_memberships m
 JOIN public.businesses b ON b.id=m.business_id
 JOIN public.loyalty_programs pr ON pr.business_id=b.id
 JOIN public.profiles p ON p.id=m.customer_id
 WHERE m.card_token=p_token AND b.active AND public.is_business_staff(m.business_id);
END $$;
REVOKE ALL ON FUNCTION public.staff_lookup_card(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_lookup_card(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.staff_lookup_voucher(p_token uuid)
RETURNS TABLE(membership_id uuid,business_id uuid,business_name text,customer_name text,
 program_type text,balance integer,reward_label text,reward_cost integer,voucher_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 RETURN QUERY SELECT m.id,b.id,b.name,
  CASE WHEN nullif(btrim(coalesce(p.full_name,'')),'') IS NULL THEN 'Cliente'::text ELSE
   (split_part(btrim(p.full_name),' ',1)||
    CASE WHEN split_part(btrim(p.full_name),' ',2)<>'' THEN
     ' '||upper(left(split_part(btrim(p.full_name),' ',2),1))||'.' ELSE '' END)::text END,
  pr.type,m.balance,v.reward_label,pr.reward_cost,v.id
 FROM public.reward_vouchers v
 JOIN public.loyalty_memberships m ON m.id=v.membership_id
 JOIN public.businesses b ON b.id=v.business_id
 JOIN public.loyalty_programs pr ON pr.business_id=b.id
 JOIN public.profiles p ON p.id=m.customer_id
 WHERE v.token=p_token AND v.status='issued' AND m.balance>=pr.reward_cost
  AND b.active AND public.is_business_staff(v.business_id);
END $$;
REVOKE ALL ON FUNCTION public.staff_lookup_voucher(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_lookup_voucher(uuid) TO authenticated;
