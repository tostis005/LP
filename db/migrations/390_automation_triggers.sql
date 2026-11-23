-- Motor de fidelización: añadir disparadores concretos y verificables por negocio.
-- signup: nueva tarjeta; no_visit: no hizo su primera compra en N días;
-- visits: N visitas verificadas; inactivity: N días sin volver tras una compra;
-- stamps: N sellos dentro de los primeros X días; first_redeem: primer canje.
ALTER TABLE public.automation_rules
 ADD COLUMN IF NOT EXISTS target_visits integer CHECK(target_visits BETWEEN 1 AND 500),
 ADD COLUMN IF NOT EXISTS inactivity_days integer CHECK(inactivity_days BETWEEN 1 AND 365);

ALTER TABLE public.automation_rules DROP CONSTRAINT IF EXISTS automation_rules_trigger_kind_check;
ALTER TABLE public.automation_rules
 ADD CONSTRAINT automation_rules_trigger_kind_check CHECK(
  trigger_kind IN ('signup','stamps','visits','no_visit','inactivity','first_redeem')
 );
ALTER TABLE public.automation_rules DROP CONSTRAINT IF EXISTS automation_rule_fields;
ALTER TABLE public.automation_rules ADD CONSTRAINT automation_rule_fields CHECK(
 (trigger_kind='signup' AND target_stamps IS NULL AND window_days IS NULL
  AND target_visits IS NULL AND inactivity_days IS NULL AND staff_instruction='')
 OR
 (trigger_kind='stamps' AND target_stamps IS NOT NULL AND window_days IS NOT NULL
  AND target_visits IS NULL AND inactivity_days IS NULL)
 OR
 (trigger_kind='visits' AND target_visits IS NOT NULL AND target_stamps IS NULL
  AND window_days IS NULL AND inactivity_days IS NULL AND staff_instruction='')
 OR
 (trigger_kind IN ('no_visit','inactivity') AND inactivity_days IS NOT NULL
  AND delay_days=0 AND target_stamps IS NULL AND window_days IS NULL
  AND target_visits IS NULL AND staff_instruction='')
 OR
 (trigger_kind='first_redeem' AND target_stamps IS NULL AND window_days IS NULL
  AND target_visits IS NULL AND inactivity_days IS NULL AND staff_instruction='')
);

-- Solo aplica a altas futuras; las nuevas reglas no disparan eventos históricos.
CREATE OR REPLACE FUNCTION public.enqueue_signup_automation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.automation_queue(rule_id,membership_id,due_at)
 SELECT r.id,NEW.id,NEW.created_at+
  make_interval(days=>(CASE WHEN r.trigger_kind='no_visit'
   THEN r.inactivity_days ELSE r.delay_days END))
 FROM public.automation_rules r
 WHERE r.business_id=NEW.business_id AND r.active
   AND r.trigger_kind IN ('signup','no_visit')
 ON CONFLICT(rule_id,membership_id) DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_signup_automation() FROM PUBLIC,anon,authenticated;

-- Los disparadores de compra se nutren de movimientos verificados en caja.
-- Una reversión posterior no se cuenta cuando llega el momento del aviso.
CREATE OR REPLACE FUNCTION public.enqueue_transaction_automation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count integer;
BEGIN
 IF NEW.kind='earn' AND NEW.reversal_of IS NULL THEN
  SELECT count(*)::integer INTO v_count FROM public.loyalty_transactions t
  WHERE t.membership_id=NEW.membership_id AND t.kind='earn'
   AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=t.id);
  INSERT INTO public.automation_queue(rule_id,membership_id,due_at)
  SELECT r.id,NEW.membership_id,NEW.created_at+make_interval(days=>r.delay_days)
  FROM public.automation_rules r
  WHERE r.business_id=NEW.business_id AND r.active AND r.trigger_kind='visits'
   AND r.target_visits=v_count
  ON CONFLICT(rule_id,membership_id) DO NOTHING;
  -- La inactividad se calcula desde la última compra; cada compra nueva
  -- reinicia el reloj sin enviar recordatorios mientras el cliente esté activo.
  INSERT INTO public.automation_queue(rule_id,membership_id,due_at)
  SELECT r.id,NEW.membership_id,NEW.created_at+make_interval(days=>r.inactivity_days)
  FROM public.automation_rules r
  WHERE r.business_id=NEW.business_id AND r.active AND r.trigger_kind='inactivity'
  ON CONFLICT(rule_id,membership_id) DO UPDATE
  SET due_at=EXCLUDED.due_at,status='pending',processed_at=NULL;
 ELSIF NEW.kind='redeem' AND NEW.reversal_of IS NULL THEN
  SELECT count(*)::integer INTO v_count FROM public.loyalty_transactions t
  WHERE t.membership_id=NEW.membership_id AND t.kind='redeem'
   AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=t.id);
  IF v_count=1 THEN
   INSERT INTO public.automation_queue(rule_id,membership_id,due_at)
   SELECT r.id,NEW.membership_id,NEW.created_at+make_interval(days=>r.delay_days)
   FROM public.automation_rules r
   WHERE r.business_id=NEW.business_id AND r.active AND r.trigger_kind='first_redeem'
   ON CONFLICT(rule_id,membership_id) DO NOTHING;
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS automation_on_transaction ON public.loyalty_transactions;
CREATE TRIGGER automation_on_transaction AFTER INSERT ON public.loyalty_transactions
 FOR EACH ROW EXECUTE FUNCTION public.enqueue_transaction_automation();
REVOKE ALL ON FUNCTION public.enqueue_transaction_automation() FROM PUBLIC,anon,authenticated;

-- Consentimiento vigente y cumplimiento efectivo del disparador justo antes
-- de entregar el mensaje. Ningún canal externo se envía por este motor.
CREATE OR REPLACE FUNCTION public.dispatch_due_automations(p_limit integer DEFAULT 100)
RETURNS TABLE(delivered integer,skipped integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_delivered integer:=0;v_skipped integer:=0;v_ok boolean;v_job record;
BEGIN
 IF p_limit NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Límite incorrecto'; END IF;
 FOR v_job IN
  SELECT q.id,q.membership_id,r.offer_id,r.active,r.business_id,
   r.trigger_kind,r.target_stamps,r.target_visits,r.inactivity_days,
   m.customer_id,m.total_earned
  FROM public.automation_queue q
  JOIN public.automation_rules r ON r.id=q.rule_id
  JOIN public.loyalty_memberships m ON m.id=q.membership_id
  JOIN public.businesses b ON b.id=r.business_id
  WHERE q.status='pending' AND q.due_at<=now() AND r.active AND b.active
  ORDER BY q.due_at,q.id
  LIMIT p_limit FOR UPDATE OF q SKIP LOCKED
 LOOP
  SELECT (
   EXISTS(SELECT 1 FROM public.marketing_consents c
    WHERE c.business_id=v_job.business_id AND c.customer_id=v_job.customer_id
    AND (c.opted_in OR c.push_opted_in OR c.whatsapp_opted_in))
   AND
   CASE v_job.trigger_kind
    WHEN 'signup' THEN true
    WHEN 'stamps' THEN v_job.total_earned>=v_job.target_stamps
    WHEN 'visits' THEN (SELECT count(*) FROM public.loyalty_transactions t
     WHERE t.membership_id=v_job.membership_id AND t.kind='earn'
      AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=t.id))
       >=v_job.target_visits
    WHEN 'no_visit' THEN NOT EXISTS(SELECT 1 FROM public.loyalty_transactions t
     WHERE t.membership_id=v_job.membership_id AND t.kind='earn'
      AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=t.id))
    WHEN 'inactivity' THEN EXISTS(SELECT 1 FROM public.loyalty_transactions t
     WHERE t.membership_id=v_job.membership_id AND t.kind='earn'
      AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=t.id))
     AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions t
      WHERE t.membership_id=v_job.membership_id AND t.kind='earn'
       AND t.created_at>now()-make_interval(days=>v_job.inactivity_days)
       AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=t.id))
    WHEN 'first_redeem' THEN EXISTS(SELECT 1 FROM public.loyalty_transactions t
     WHERE t.membership_id=v_job.membership_id AND t.kind='redeem'
      AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=t.id))
    ELSE false
   END
  ) INTO v_ok;
  IF v_ok THEN
   INSERT INTO public.offer_receipts(offer_id,customer_id)
   VALUES(v_job.offer_id,v_job.customer_id)
   ON CONFLICT(offer_id,customer_id) DO NOTHING;
   v_delivered:=v_delivered+1;
  ELSE v_skipped:=v_skipped+1;
  END IF;
  UPDATE public.automation_queue
  SET status=CASE WHEN v_ok THEN 'delivered' ELSE 'skipped' END,processed_at=now()
  WHERE id=v_job.id;
 END LOOP;
 RETURN QUERY SELECT v_delivered,v_skipped;
END $$;
REVOKE ALL ON FUNCTION public.dispatch_due_automations(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_due_automations(integer) TO lp_auth;
