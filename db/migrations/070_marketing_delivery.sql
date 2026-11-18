-- Campañas de email: cola privada, consentimiento por comercio y cargo solo por SMTP aceptado.
ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_status_check;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_status_check
 CHECK(status IN ('draft','queued','sending','sent','partial','failed'));
ALTER TABLE public.marketing_campaigns
 ADD COLUMN IF NOT EXISTS recipient_count integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS sent_count integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS failed_count integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS total_cents bigint NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'MXN';

CREATE TABLE IF NOT EXISTS public.marketing_deliveries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 unsubscribe_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 price_cents integer NOT NULL CHECK(price_cents >= 0),
 currency text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed')),
 reserved_at timestamptz,
 sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(campaign_id,customer_id)
);
CREATE INDEX IF NOT EXISTS marketing_deliveries_queue_idx ON public.marketing_deliveries(campaign_id,status);
ALTER TABLE public.marketing_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketing_deliveries_manager_read ON public.marketing_deliveries;
CREATE POLICY marketing_deliveries_manager_read ON public.marketing_deliveries
 FOR SELECT TO authenticated USING(public.is_business_manager(business_id) OR public.is_platform_admin());

CREATE TABLE IF NOT EXISTS public.marketing_usage_ledger(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 delivery_id uuid NOT NULL UNIQUE REFERENCES public.marketing_deliveries(id),
 campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id),
 business_id uuid NOT NULL REFERENCES public.businesses(id),
 price_cents integer NOT NULL CHECK(price_cents >= 0),
 currency text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_usage_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketing_ledger_manager_read ON public.marketing_usage_ledger;
CREATE POLICY marketing_ledger_manager_read ON public.marketing_usage_ledger
 FOR SELECT TO authenticated USING(public.is_business_manager(business_id) OR public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.queue_business_campaign(p_campaign uuid,p_expected_cents bigint)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_campaign public.marketing_campaigns%rowtype; v_price integer; v_currency text; v_count integer;
BEGIN
 SELECT * INTO v_campaign FROM public.marketing_campaigns WHERE id=p_campaign FOR UPDATE;
 IF NOT FOUND OR v_campaign.business_id IS NULL THEN RAISE EXCEPTION 'Campaña no encontrada'; END IF;
 IF NOT (public.is_business_manager(v_campaign.business_id) OR public.is_platform_admin()) THEN
  RAISE EXCEPTION 'No autorizado'; END IF;
 IF v_campaign.status<>'draft' THEN RAISE EXCEPTION 'Esta campaña ya ha sido procesada'; END IF;
 IF length(trim(v_campaign.subject))<3 OR length(trim(v_campaign.body_text))<3 THEN
  RAISE EXCEPTION 'Completa asunto y mensaje'; END IF;
 SELECT coalesce(r.price_cents,1),coalesce(r.currency,'MXN') INTO v_price,v_currency
  FROM (SELECT 1) x LEFT JOIN public.business_marketing_rates r ON r.business_id=v_campaign.business_id;
 INSERT INTO public.marketing_deliveries(campaign_id,business_id,customer_id,price_cents,currency)
 SELECT p_campaign,v_campaign.business_id,m.customer_id,v_price,v_currency
 FROM public.loyalty_memberships m
 JOIN auth.users u ON u.id=m.customer_id AND u.email_confirmed_at IS NOT NULL
 JOIN public.marketing_consents c ON c.business_id=m.business_id AND c.customer_id=m.customer_id AND c.opted_in
 WHERE m.business_id=v_campaign.business_id
 ON CONFLICT(campaign_id,customer_id) DO NOTHING;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count=0 THEN RAISE EXCEPTION 'No hay destinatarios con consentimiento'; END IF;
 IF p_expected_cents IS NULL OR v_count::bigint*v_price<>p_expected_cents THEN
  RAISE EXCEPTION 'El presupuesto ha cambiado; vuelve a confirmarlo'; END IF;
 UPDATE public.marketing_campaigns SET status='queued',recipient_count=v_count,
 total_cents=v_count::bigint*v_price,currency=v_currency WHERE id=p_campaign;
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.queue_business_campaign(uuid,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.queue_business_campaign(uuid,bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_campaign_delivery(p_campaign uuid)
RETURNS TABLE(delivery_id uuid,email text,subject text,body_text text,business_name text,unsubscribe_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 SELECT d.id INTO v_id FROM public.marketing_deliveries d
 JOIN public.marketing_campaigns c ON c.id=d.campaign_id
 WHERE d.campaign_id=p_campaign AND c.status IN ('queued','sending')
 AND (d.status='pending' OR (d.status='sending' AND d.reserved_at<now()-interval '10 minutes'))
 ORDER BY d.created_at,d.id LIMIT 1 FOR UPDATE OF d SKIP LOCKED;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.marketing_deliveries SET status='sending',reserved_at=now() WHERE id=v_id;
 UPDATE public.marketing_campaigns SET status='sending' WHERE id=p_campaign AND status='queued';
 RETURN QUERY SELECT d.id,u.email::text,c.subject,c.body_text,b.name,d.unsubscribe_token
 FROM public.marketing_deliveries d
 JOIN public.marketing_campaigns c ON c.id=d.campaign_id
 JOIN public.businesses b ON b.id=d.business_id
 JOIN auth.users u ON u.id=d.customer_id
 WHERE d.id=v_id;
END $$;

CREATE OR REPLACE FUNCTION public.finish_campaign_delivery(p_id uuid,p_success boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_delivery public.marketing_deliveries%rowtype; v_remaining bigint; v_failed bigint;
BEGIN
 SELECT * INTO v_delivery FROM public.marketing_deliveries WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR v_delivery.status<>'sending' THEN RETURN; END IF;
 UPDATE public.marketing_deliveries
  SET status=CASE WHEN p_success THEN 'sent' ELSE 'failed' END,
      sent_at=CASE WHEN p_success THEN now() ELSE NULL END,reserved_at=NULL
 WHERE id=p_id;
 IF p_success THEN
  INSERT INTO public.marketing_usage_ledger(delivery_id,campaign_id,business_id,price_cents,currency)
  VALUES(p_id,v_delivery.campaign_id,v_delivery.business_id,v_delivery.price_cents,v_delivery.currency)
  ON CONFLICT(delivery_id) DO NOTHING;
 END IF;
 SELECT count(*) FILTER(WHERE status IN('pending','sending')),
        count(*) FILTER(WHERE status='failed')
 INTO v_remaining,v_failed FROM public.marketing_deliveries WHERE campaign_id=v_delivery.campaign_id;
 UPDATE public.marketing_campaigns SET
   sent_count=(SELECT count(*) FROM public.marketing_deliveries WHERE campaign_id=v_delivery.campaign_id AND status='sent'),
   failed_count=v_failed,
   status=CASE WHEN v_remaining>0 THEN 'sending' WHEN v_failed>0 THEN 'partial' ELSE 'sent' END
 WHERE id=v_delivery.campaign_id;
END $$;

CREATE OR REPLACE FUNCTION public.unsubscribe_campaign_recipient(p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_customer uuid;v_business uuid;
BEGIN
 SELECT customer_id,business_id INTO v_customer,v_business
 FROM public.marketing_deliveries WHERE unsubscribe_token=p_token;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.marketing_consents SET opted_in=false,updated_at=now()
 WHERE customer_id=v_customer AND business_id=v_business;
 RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.claim_campaign_delivery(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_campaign_delivery(uuid,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.unsubscribe_campaign_recipient(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_campaign_delivery(uuid) TO lp_auth;
GRANT EXECUTE ON FUNCTION public.finish_campaign_delivery(uuid,boolean) TO lp_auth;
GRANT EXECUTE ON FUNCTION public.unsubscribe_campaign_recipient(uuid) TO lp_auth;
