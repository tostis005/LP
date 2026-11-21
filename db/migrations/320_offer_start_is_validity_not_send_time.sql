-- La fecha de inicio define cuándo se puede disfrutar de la oferta, no cuándo
-- es posible anunciarla. El negocio puede avisar antes de que comience.
CREATE OR REPLACE FUNCTION public.reject_expired_offer_campaign()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_until date;
BEGIN
 IF OLD.status='draft' AND NEW.status='queued' THEN
  IF TG_TABLE_NAME='push_campaigns' THEN
   SELECT o.valid_until INTO v_until FROM public.business_offers o WHERE o.push_campaign_id=NEW.id;
  ELSIF TG_TABLE_NAME='marketing_campaigns' THEN
   SELECT o.valid_until INTO v_until FROM public.business_offers o WHERE o.id=NEW.offer_id;
  END IF;
  IF v_until IS NOT NULL AND v_until<CURRENT_DATE
  THEN RAISE EXCEPTION 'La oferta ya ha caducado. Crea una nueva para enviarla.'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.reject_expired_offer_campaign() FROM PUBLIC,anon,authenticated;
