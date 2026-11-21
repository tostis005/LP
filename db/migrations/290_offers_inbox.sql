-- Una oferta es reutilizable entre canales; la bandeja sólo almacena entregas aceptadas.
CREATE TABLE IF NOT EXISTS public.business_offers(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 3 AND 50),
 preview text NOT NULL CHECK(length(trim(preview)) BETWEEN 3 AND 120),
 details text NOT NULL CHECK(length(trim(details)) BETWEEN 3 AND 6000),
 terms text NOT NULL DEFAULT '' CHECK(length(terms)<=1500),
 image_url text CHECK(image_url IS NULL OR length(image_url)<=300),
 valid_until date,
 push_campaign_id uuid UNIQUE REFERENCES public.push_campaigns(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_offers_business_idx ON public.business_offers(business_id,created_at DESC);
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES public.business_offers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS marketing_campaign_offer_idx ON public.marketing_campaigns(offer_id) WHERE offer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.offer_receipts(
 offer_id uuid NOT NULL REFERENCES public.business_offers(id) ON DELETE CASCADE,
 customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 received_at timestamptz NOT NULL DEFAULT now(),
 seen_at timestamptz,
 PRIMARY KEY(offer_id,customer_id)
);
CREATE INDEX IF NOT EXISTS offer_receipts_customer_idx ON public.offer_receipts(customer_id,received_at DESC);
ALTER TABLE public.business_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS offer_receipts_read ON public.offer_receipts;
CREATE POLICY offer_receipts_read ON public.offer_receipts FOR SELECT TO authenticated
 USING(customer_id=auth.uid());
DROP POLICY IF EXISTS offer_receipts_update ON public.offer_receipts;
CREATE POLICY offer_receipts_update ON public.offer_receipts FOR UPDATE TO authenticated
 USING(customer_id=auth.uid()) WITH CHECK(customer_id=auth.uid());
DROP POLICY IF EXISTS business_offers_read ON public.business_offers;
CREATE POLICY business_offers_read ON public.business_offers FOR SELECT TO authenticated
 USING(public.is_business_manager(business_id) OR public.is_platform_admin()
 OR EXISTS(SELECT 1 FROM public.offer_receipts r WHERE r.offer_id=id AND r.customer_id=auth.uid()));
DROP POLICY IF EXISTS business_offers_create ON public.business_offers;
CREATE POLICY business_offers_create ON public.business_offers FOR INSERT TO authenticated
 WITH CHECK(public.is_business_manager(business_id) AND created_by=auth.uid());
DROP POLICY IF EXISTS business_offers_update ON public.business_offers;
CREATE POLICY business_offers_update ON public.business_offers FOR UPDATE TO authenticated
 USING(public.is_business_manager(business_id))
 WITH CHECK(public.is_business_manager(business_id));
GRANT SELECT,INSERT,UPDATE ON public.business_offers TO authenticated;
GRANT SELECT,UPDATE ON public.offer_receipts TO authenticated;

-- La bandeja es personal. Nunca se concede al negocio acceso a los destinatarios.
-- Una entrega sólo se registra al confirmarse que el proveedor ha aceptado el mensaje.
CREATE OR REPLACE FUNCTION public.record_delivered_offer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_offer uuid;
BEGIN
 IF NEW.status='sent' AND OLD.status IS DISTINCT FROM NEW.status THEN
  IF TG_TABLE_NAME='push_deliveries' THEN
   SELECT o.id INTO v_offer FROM public.business_offers o
   WHERE o.push_campaign_id=NEW.campaign_id;
  ELSIF TG_TABLE_NAME='marketing_deliveries' THEN
   SELECT c.offer_id INTO v_offer FROM public.marketing_campaigns c
   WHERE c.id=NEW.campaign_id;
  END IF;
  IF v_offer IS NOT NULL THEN
   INSERT INTO public.offer_receipts(offer_id,customer_id)
   VALUES(v_offer,NEW.customer_id)
   ON CONFLICT(offer_id,customer_id) DO NOTHING;
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS push_offer_delivered ON public.push_deliveries;
CREATE TRIGGER push_offer_delivered AFTER UPDATE OF status ON public.push_deliveries
 FOR EACH ROW EXECUTE FUNCTION public.record_delivered_offer();
DROP TRIGGER IF EXISTS marketing_offer_delivered ON public.marketing_deliveries;
CREATE TRIGGER marketing_offer_delivered AFTER UPDATE OF status ON public.marketing_deliveries
 FOR EACH ROW EXECUTE FUNCTION public.record_delivered_offer();
REVOKE ALL ON FUNCTION public.record_delivered_offer() FROM PUBLIC,anon,authenticated;

-- Nunca empezar a enviar ofertas caducadas, sin alterar las campañas históricas.
CREATE OR REPLACE FUNCTION public.reject_expired_offer_campaign()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_expiry date;
BEGIN
 IF OLD.status='draft' AND NEW.status='queued' THEN
  IF TG_TABLE_NAME='push_campaigns' THEN
   SELECT o.valid_until INTO v_expiry FROM public.business_offers o WHERE o.push_campaign_id=NEW.id;
  ELSIF TG_TABLE_NAME='marketing_campaigns' THEN
   SELECT o.valid_until INTO v_expiry FROM public.business_offers o WHERE o.id=NEW.offer_id;
  END IF;
  IF v_expiry IS NOT NULL AND v_expiry<CURRENT_DATE THEN
   RAISE EXCEPTION 'Esta oferta ya ha caducado. Crea una nueva para enviarla.';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS push_offer_expiry ON public.push_campaigns;
CREATE TRIGGER push_offer_expiry BEFORE UPDATE OF status ON public.push_campaigns
 FOR EACH ROW EXECUTE FUNCTION public.reject_expired_offer_campaign();
DROP TRIGGER IF EXISTS marketing_offer_expiry ON public.marketing_campaigns;
CREATE TRIGGER marketing_offer_expiry BEFORE UPDATE OF status ON public.marketing_campaigns
 FOR EACH ROW EXECUTE FUNCTION public.reject_expired_offer_campaign();
REVOKE ALL ON FUNCTION public.reject_expired_offer_campaign() FROM PUBLIC,anon,authenticated;
