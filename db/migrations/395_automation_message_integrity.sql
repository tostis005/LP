-- Evitar modificar promociones automáticas ya vistas por usuarios.
-- SECURITY DEFINER puede verificar la existencia de recibos sin dar acceso al negocio
-- a la lista de destinatarios, que sigue siendo privada.
CREATE OR REPLACE FUNCTION public.prevent_delivered_automation_edits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.automation_rules r WHERE r.offer_id=OLD.id)
    AND EXISTS(SELECT 1 FROM public.offer_receipts x WHERE x.offer_id=OLD.id)
    AND ROW(OLD.title,OLD.preview,OLD.details) IS DISTINCT FROM ROW(NEW.title,NEW.preview,NEW.details)
 THEN RAISE EXCEPTION 'El mensaje ya fue entregado. Pausa la campaña y crea otra para modificar el contenido.';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS automation_delivered_offer_immutable ON public.business_offers;
CREATE TRIGGER automation_delivered_offer_immutable BEFORE UPDATE ON public.business_offers
 FOR EACH ROW EXECUTE FUNCTION public.prevent_delivered_automation_edits();
REVOKE ALL ON FUNCTION public.prevent_delivered_automation_edits() FROM PUBLIC,anon,authenticated;
