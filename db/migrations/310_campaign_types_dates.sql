-- Todas las campañas comparten bandeja y canales; las promociones pueden tener vigencia.
ALTER TABLE public.business_offers ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'offer';
ALTER TABLE public.business_offers DROP CONSTRAINT IF EXISTS business_offers_kind_check;
ALTER TABLE public.business_offers ADD CONSTRAINT business_offers_kind_check CHECK(kind IN ('offer','news','notice'));
ALTER TABLE public.business_offers ADD COLUMN IF NOT EXISTS valid_from date;
ALTER TABLE public.business_offers DROP CONSTRAINT IF EXISTS business_offers_valid_dates_check;
ALTER TABLE public.business_offers ADD CONSTRAINT business_offers_valid_dates_check
 CHECK(valid_from IS NULL OR valid_until IS NULL OR valid_from<=valid_until);
-- Se conserva el esquema anterior para mantener las campañas y notificaciones existentes.
CREATE OR REPLACE FUNCTION public.reject_expired_offer_campaign()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_from date;v_until date;
BEGIN
 IF OLD.status='draft' AND NEW.status='queued' THEN
  IF TG_TABLE_NAME='push_campaigns' THEN
   SELECT o.valid_from,o.valid_until INTO v_from,v_until FROM public.business_offers o WHERE o.push_campaign_id=NEW.id;
  ELSIF TG_TABLE_NAME='marketing_campaigns' THEN
   SELECT o.valid_from,o.valid_until INTO v_from,v_until FROM public.business_offers o WHERE o.id=NEW.offer_id;
  END IF;
  IF v_from IS NOT NULL AND v_from>CURRENT_DATE
  THEN RAISE EXCEPTION 'La campaña comienza más adelante. Todavía no puede enviarse.'; END IF;
  IF v_until IS NOT NULL AND v_until<CURRENT_DATE
  THEN RAISE EXCEPTION 'La promoción ya ha caducado. Crea una nueva para enviarla.'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.reject_expired_offer_campaign() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.prevent_confirmed_offer_edits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.offer_campaign_charges c WHERE c.offer_id=OLD.id) THEN
  IF ROW(NEW.title,NEW.preview,NEW.details,NEW.terms,NEW.image_url,NEW.valid_from,NEW.valid_until,NEW.kind,NEW.push_campaign_id)
   IS DISTINCT FROM ROW(OLD.title,OLD.preview,OLD.details,OLD.terms,OLD.image_url,OLD.valid_from,OLD.valid_until,OLD.kind,OLD.push_campaign_id)
  THEN RAISE EXCEPTION 'No puedes modificar una campaña ya confirmada'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.prevent_confirmed_offer_edits() FROM PUBLIC,anon,authenticated;
