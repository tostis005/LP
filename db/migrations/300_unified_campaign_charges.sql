-- Campañas multicanal: el importe se confirma una sola vez al iniciar el envío.
-- Las entregas técnicas siguen registrándose por proveedor, pero no se cobran dos veces.
CREATE TABLE public.offer_campaign_charges(
 offer_id uuid NOT NULL REFERENCES public.business_offers(id) ON DELETE RESTRICT,
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
 channel text NOT NULL CHECK(channel IN ('email','whatsapp','push')),
 campaign_id uuid NOT NULL,
 recipients integer NOT NULL CHECK(recipients > 0),
 unit_price_cents integer NOT NULL CHECK(unit_price_cents >= 0),
 amount_cents bigint NOT NULL CHECK(amount_cents = recipients::bigint*unit_price_cents),
 currency text NOT NULL,
 confirmed_at timestamptz NOT NULL DEFAULT now(),
 invoiced_at timestamptz,
 invoice_reference text,
 PRIMARY KEY(offer_id,channel)
);
CREATE INDEX offer_campaign_charges_business_date_idx ON public.offer_campaign_charges(business_id,confirmed_at DESC);
ALTER TABLE public.offer_campaign_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY offer_campaign_charges_owner_read ON public.offer_campaign_charges
 FOR SELECT TO authenticated USING(public.is_business_manager(business_id) OR public.is_platform_admin());
REVOKE ALL ON public.offer_campaign_charges FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.offer_campaign_charges TO authenticated;

-- Los cargos de la campaña son inmutables desde la aplicación del negocio.
-- Sólo lp_api, mediante una operación autorizada, confirma estos cargos en la transacción del envío.
-- Añadimos los cargos fijos al extracto y excluimos el consumo por entrega de esas mismas campañas.
CREATE OR REPLACE FUNCTION public.business_marketing_usage(p_business uuid)
RETURNS TABLE(channel text,messages bigint,amount_cents bigint,currency text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT (public.is_business_manager(p_business) OR public.is_platform_admin())
 THEN RAISE EXCEPTION 'No autorizado'; END IF;
 RETURN QUERY
 SELECT q.channel::text,sum(q.messages)::bigint,sum(q.amount_cents)::bigint,q.currency::text FROM (
  SELECT c.channel::text AS channel,count(*)::bigint AS messages,
   coalesce(sum(l.price_cents),0)::bigint AS amount_cents,l.currency::text AS currency
  FROM public.marketing_usage_ledger l JOIN public.marketing_campaigns c ON c.id=l.campaign_id
  WHERE l.business_id=p_business
   AND NOT EXISTS(SELECT 1 FROM public.offer_campaign_charges oc
    WHERE oc.channel=c.channel AND oc.campaign_id=c.id)
  GROUP BY c.channel,l.currency
  UNION ALL
  SELECT 'push'::text,count(*)::bigint,coalesce(sum(l.price_cents),0)::bigint,l.currency::text
  FROM public.push_usage_ledger l JOIN public.push_campaigns p ON p.id=l.campaign_id
  WHERE l.business_id=p_business
   AND NOT EXISTS(SELECT 1 FROM public.offer_campaign_charges oc
    WHERE oc.channel='push' AND oc.campaign_id=p.id)
  GROUP BY l.currency
  UNION ALL
  SELECT oc.channel::text,sum(oc.recipients)::bigint,sum(oc.amount_cents)::bigint,oc.currency::text
  FROM public.offer_campaign_charges oc WHERE oc.business_id=p_business
  GROUP BY oc.channel,oc.currency
 ) q GROUP BY q.channel,q.currency ORDER BY q.channel,q.currency;
END $$;
REVOKE ALL ON FUNCTION public.business_marketing_usage(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_marketing_usage(uuid) TO authenticated;

-- Prevenir modificaciones de campañas unificadas ya confirmadas, incluidas futuras llamadas directas.
CREATE OR REPLACE FUNCTION public.prevent_confirmed_offer_edits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.offer_campaign_charges c WHERE c.offer_id=OLD.id) THEN
  IF ROW(NEW.title,NEW.preview,NEW.details,NEW.terms,NEW.image_url,NEW.valid_until,NEW.push_campaign_id)
   IS DISTINCT FROM ROW(OLD.title,OLD.preview,OLD.details,OLD.terms,OLD.image_url,OLD.valid_until,OLD.push_campaign_id)
  THEN RAISE EXCEPTION 'No puedes modificar una campaña ya confirmada'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER offer_lock_after_confirm BEFORE UPDATE ON public.business_offers
 FOR EACH ROW EXECUTE FUNCTION public.prevent_confirmed_offer_edits();
REVOKE ALL ON FUNCTION public.prevent_confirmed_offer_edits() FROM PUBLIC,anon,authenticated;

-- La confirmación es una única transacción con bloqueo de la oferta y de las tarifas.
-- Comprueba de nuevo destinatarios y precio antes de insertar cargos y encolar.
CREATE OR REPLACE FUNCTION public.confirm_offer_campaign(p_offer uuid,p_expected_total bigint)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 v_offer public.business_offers%rowtype;
 v_email uuid; v_wa uuid; v_push uuid;
 v_currency text; v_result bigint:=0;
 e_count bigint:=0; w_count bigint:=0; p_count bigint:=0;
 e_price integer; w_price integer; p_price integer;
 e_total bigint:=0; w_total bigint:=0; p_total bigint:=0;
 e_currency text; w_currency text; p_currency text;
BEGIN
 SELECT * INTO v_offer FROM public.business_offers WHERE id=p_offer FOR UPDATE;
 IF NOT FOUND OR NOT public.is_business_manager(v_offer.business_id)
 THEN RAISE EXCEPTION 'No autorizado'; END IF;
 IF v_offer.valid_until IS NOT NULL AND v_offer.valid_until<CURRENT_DATE
 THEN RAISE EXCEPTION 'La oferta ya ha caducado'; END IF;
 IF EXISTS(SELECT 1 FROM public.offer_campaign_charges WHERE offer_id=p_offer)
 THEN RAISE EXCEPTION 'El envío ya se ha confirmado. Reanuda la campaña, sin volver a cobrar.'; END IF;
 -- Congelamos las tarifas del negocio durante la confirmación.
 PERFORM 1 FROM public.business_marketing_rates WHERE business_id=v_offer.business_id FOR SHARE;
 SELECT c.id INTO v_email FROM public.marketing_campaigns c
 WHERE c.offer_id=p_offer AND c.channel='email' AND c.status='draft';
 SELECT c.id INTO v_wa FROM public.marketing_campaigns c
 WHERE c.offer_id=p_offer AND c.channel='whatsapp' AND c.status='draft';
 v_push:=v_offer.push_campaign_id;
 IF EXISTS(SELECT 1 FROM public.marketing_campaigns c WHERE c.offer_id=p_offer AND c.status<>'draft')
 OR (v_push IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.push_campaigns WHERE id=v_push AND status='draft'))
 THEN RAISE EXCEPTION 'Campaña ya iniciada o no disponible'; END IF;
 IF v_email IS NULL AND v_wa IS NULL AND v_push IS NULL
 THEN RAISE EXCEPTION 'Selecciona al menos un canal'; END IF;
 IF v_email IS NOT NULL THEN
  SELECT contacts,price_cents,total_cents,currency INTO e_count,e_price,e_total,e_currency
  FROM public.business_mail_quote(v_offer.business_id);
  IF coalesce(e_count,0)=0 OR e_price IS NULL
  THEN RAISE EXCEPTION 'No hay contactos de correo disponibles'; END IF;
  v_currency:=e_currency;
  v_result:=v_result+e_total;
 END IF;
 IF v_wa IS NOT NULL THEN
  SELECT contacts,price_cents,total_cents,currency INTO w_count,w_price,w_total,w_currency
  FROM public.business_whatsapp_quote(v_offer.business_id);
  IF coalesce(w_count,0)=0 OR w_price IS NULL
  THEN RAISE EXCEPTION 'WhatsApp no tiene destinatarios o tarifa'; END IF;
  IF v_currency IS NOT NULL AND v_currency<>w_currency THEN RAISE EXCEPTION 'Monedas incompatibles'; END IF;
  v_currency:=w_currency;
  v_result:=v_result+w_total;
 END IF;
 IF v_push IS NOT NULL THEN
  SELECT devices,price_cents,total_cents,currency INTO p_count,p_price,p_total,p_currency
  FROM public.business_push_pricing(v_offer.business_id);
  IF coalesce(p_count,0)=0 OR p_price IS NULL
  THEN RAISE EXCEPTION 'Push no tiene destinatarios o tarifa'; END IF;
  IF v_currency IS NOT NULL AND v_currency<>p_currency THEN RAISE EXCEPTION 'Monedas incompatibles'; END IF;
  v_currency:=p_currency;
  v_result:=v_result+p_total;
 END IF;
 IF p_expected_total IS NULL OR v_result<>p_expected_total
 THEN RAISE EXCEPTION 'La tarifa o los destinatarios han cambiado. Actualiza el precio y confirma de nuevo.'; END IF;
 IF v_email IS NOT NULL THEN
  PERFORM public.queue_business_campaign(v_email,e_total);
  INSERT INTO public.offer_campaign_charges(offer_id,business_id,channel,campaign_id,recipients,unit_price_cents,amount_cents,currency)
  VALUES(p_offer,v_offer.business_id,'email',v_email,e_count::integer,e_price,e_total,v_currency);
 END IF;
 IF v_wa IS NOT NULL THEN
  PERFORM public.queue_business_campaign(v_wa,w_total);
  INSERT INTO public.offer_campaign_charges(offer_id,business_id,channel,campaign_id,recipients,unit_price_cents,amount_cents,currency)
  VALUES(p_offer,v_offer.business_id,'whatsapp',v_wa,w_count::integer,w_price,w_total,v_currency);
 END IF;
 IF v_push IS NOT NULL THEN
  PERFORM public.business_queue_push_campaign(v_push,p_total);
  INSERT INTO public.offer_campaign_charges(offer_id,business_id,channel,campaign_id,recipients,unit_price_cents,amount_cents,currency)
  VALUES(p_offer,v_offer.business_id,'push',v_push,p_count::integer,p_price,p_total,v_currency);
 END IF;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.confirm_offer_campaign(uuid,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_offer_campaign(uuid,bigint) TO authenticated;
