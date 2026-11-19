-- Canales de campañas independientes. Email mantiene la facturación existente.
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'email';
ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaign_channel_check;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaign_channel_check
 CHECK(channel IN ('email','whatsapp'));
ALTER TABLE public.marketing_campaigns
 ADD COLUMN IF NOT EXISTS template_name text,
 ADD COLUMN IF NOT EXISTS template_language text;

-- Consentimiento de WhatsApp separado del email; nunca se presupone.
ALTER TABLE public.marketing_consents ADD COLUMN IF NOT EXISTS whatsapp_opted_in boolean NOT NULL DEFAULT false;
-- La plataforma define las tarifas. NULL significa todavía no disponible.
ALTER TABLE public.business_marketing_rates ADD COLUMN IF NOT EXISTS whatsapp_price_cents integer
 CHECK(whatsapp_price_cents BETWEEN 0 AND 100000);

CREATE OR REPLACE FUNCTION public.business_whatsapp_quote(p_business uuid)
RETURNS TABLE(contacts bigint,price_cents integer,total_cents bigint,currency text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count bigint;v_price integer;v_currency text;
BEGIN
 IF NOT (public.is_business_manager(p_business) OR public.is_platform_admin()) THEN
  RAISE EXCEPTION 'No autorizado';
 END IF;
 SELECT r.whatsapp_price_cents,r.currency INTO v_price,v_currency
 FROM public.business_marketing_rates r WHERE r.business_id=p_business;
 SELECT count(DISTINCT m.customer_id) INTO v_count
 FROM public.loyalty_memberships m
 JOIN public.marketing_consents c ON c.business_id=m.business_id
   AND c.customer_id=m.customer_id AND c.whatsapp_opted_in
 JOIN auth.users u ON u.id=m.customer_id AND u.email_confirmed_at IS NOT NULL
 WHERE m.business_id=p_business
   AND u.raw_user_meta_data->>'whatsapp' ~ '^\+[1-9][0-9]{7,14}$';
 RETURN QUERY SELECT v_count,v_price,
  CASE WHEN v_price IS NULL THEN NULL::bigint ELSE v_count*v_price END,
  coalesce(v_currency,'MXN')::text;
END $$;
REVOKE ALL ON FUNCTION public.business_whatsapp_quote(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_whatsapp_quote(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.business_upsert_whatsapp_consent(p_business uuid,p_opted_in boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.loyalty_memberships m WHERE m.business_id=p_business AND m.customer_id=auth.uid())
 THEN RAISE EXCEPTION 'Debes tener una tarjeta de este negocio para cambiar esta preferencia'; END IF;
 IF p_opted_in AND NOT EXISTS(
  SELECT 1 FROM auth.users u WHERE u.id=auth.uid()
   AND u.raw_user_meta_data->>'whatsapp' ~ '^\+[1-9][0-9]{7,14}$')
 THEN RAISE EXCEPTION 'Añade primero tu teléfono de WhatsApp en tu perfil'; END IF;
 INSERT INTO public.marketing_consents(customer_id,business_id,opted_in,whatsapp_opted_in)
 VALUES(auth.uid(),p_business,false,p_opted_in)
 ON CONFLICT (customer_id,business_id) WHERE business_id IS NOT NULL
 DO UPDATE SET whatsapp_opted_in=EXCLUDED.whatsapp_opted_in,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.business_upsert_whatsapp_consent(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_upsert_whatsapp_consent(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.queue_business_campaign(p_campaign uuid,p_expected_cents bigint)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_campaign public.marketing_campaigns%rowtype;v_price integer;v_currency text;v_count integer;
BEGIN
 SELECT * INTO v_campaign FROM public.marketing_campaigns WHERE id=p_campaign FOR UPDATE;
 IF NOT FOUND OR v_campaign.business_id IS NULL THEN RAISE EXCEPTION 'Campaña no encontrada'; END IF;
 IF NOT (public.is_business_manager(v_campaign.business_id) OR public.is_platform_admin()) THEN
  RAISE EXCEPTION 'No autorizado'; END IF;
 IF v_campaign.status<>'draft' THEN RAISE EXCEPTION 'Esta campaña ya ha sido procesada'; END IF;
 IF length(trim(v_campaign.subject))<3 OR length(trim(v_campaign.body_text))<3 THEN
  RAISE EXCEPTION 'Completa asunto y mensaje'; END IF;
 IF v_campaign.channel='whatsapp' THEN
  IF coalesce(v_campaign.template_name,'') !~ '^[a-z0-9_]{3,256}$'
     OR coalesce(v_campaign.template_language,'') !~ '^[a-z]{2}(_[A-Z]{2})?$'
  THEN RAISE EXCEPTION 'La plantilla de WhatsApp debe estar aprobada'; END IF;
  SELECT whatsapp_price_cents,currency INTO v_price,v_currency
  FROM public.business_marketing_rates WHERE business_id=v_campaign.business_id;
  IF v_price IS NULL THEN RAISE EXCEPTION 'La plataforma todavía no ha definido la tarifa de WhatsApp'; END IF;
  INSERT INTO public.marketing_deliveries(campaign_id,business_id,customer_id,price_cents,currency)
  SELECT p_campaign,v_campaign.business_id,m.customer_id,v_price,coalesce(v_currency,'MXN')
  FROM public.loyalty_memberships m
  JOIN auth.users u ON u.id=m.customer_id AND u.email_confirmed_at IS NOT NULL
    AND u.raw_user_meta_data->>'whatsapp' ~ '^\+[1-9][0-9]{7,14}$'
  JOIN public.marketing_consents c ON c.business_id=m.business_id
    AND c.customer_id=m.customer_id AND c.whatsapp_opted_in
  WHERE m.business_id=v_campaign.business_id
  ON CONFLICT(campaign_id,customer_id) DO NOTHING;
 ELSE
  SELECT coalesce(price_cents,1),coalesce(currency,'MXN') INTO v_price,v_currency
   FROM public.business_marketing_rates WHERE business_id=v_campaign.business_id;
  v_price:=coalesce(v_price,1);v_currency:=coalesce(v_currency,'MXN');
  INSERT INTO public.marketing_deliveries(campaign_id,business_id,customer_id,price_cents,currency)
  SELECT p_campaign,v_campaign.business_id,m.customer_id,v_price,v_currency
  FROM public.loyalty_memberships m
  JOIN auth.users u ON u.id=m.customer_id AND u.email_confirmed_at IS NOT NULL
  JOIN public.marketing_consents c ON c.business_id=m.business_id
    AND c.customer_id=m.customer_id AND c.opted_in
  WHERE m.business_id=v_campaign.business_id
  ON CONFLICT(campaign_id,customer_id) DO NOTHING;
 END IF;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count=0 THEN RAISE EXCEPTION 'No hay destinatarios con consentimiento para este canal'; END IF;
 IF p_expected_cents IS NULL OR v_count::bigint*v_price<>p_expected_cents THEN
  RAISE EXCEPTION 'El presupuesto ha cambiado; vuelve a confirmarlo'; END IF;
 UPDATE public.marketing_campaigns SET status='queued',recipient_count=v_count,
 total_cents=v_count::bigint*v_price,currency=coalesce(v_currency,'MXN')
 WHERE id=p_campaign;
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.queue_business_campaign(uuid,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.queue_business_campaign(uuid,bigint) TO authenticated;

-- Funciones de cola separadas por canal, solo ejecutables por el backend privado.
CREATE OR REPLACE FUNCTION public.claim_campaign_delivery(p_campaign uuid)
RETURNS TABLE(delivery_id uuid,email text,subject text,body_text text,business_name text,unsubscribe_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 SELECT d.id INTO v_id FROM public.marketing_deliveries d
 JOIN public.marketing_campaigns c ON c.id=d.campaign_id
 WHERE d.campaign_id=p_campaign AND c.channel='email' AND c.status IN ('queued','sending')
 AND (d.status='pending' OR (d.status='sending' AND d.reserved_at<now()-interval '10 minutes'))
 ORDER BY d.created_at,d.id LIMIT 1 FOR UPDATE OF d SKIP LOCKED;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.marketing_deliveries SET status='sending',reserved_at=now() WHERE id=v_id;
 UPDATE public.marketing_campaigns SET status='sending' WHERE id=p_campaign AND status='queued';
 RETURN QUERY SELECT d.id,u.email::text,c.subject,c.body_text,b.name,d.unsubscribe_token
 FROM public.marketing_deliveries d JOIN public.marketing_campaigns c ON c.id=d.campaign_id
 JOIN public.businesses b ON b.id=d.business_id JOIN auth.users u ON u.id=d.customer_id
 WHERE d.id=v_id;
END $$;
REVOKE ALL ON FUNCTION public.claim_campaign_delivery(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_campaign_delivery(uuid) TO lp_auth;

CREATE OR REPLACE FUNCTION public.claim_whatsapp_delivery(p_campaign uuid)
RETURNS TABLE(delivery_id uuid,phone text,body_text text,template_name text,template_language text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 SELECT d.id INTO v_id FROM public.marketing_deliveries d
 JOIN public.marketing_campaigns c ON c.id=d.campaign_id
 WHERE d.campaign_id=p_campaign AND c.channel='whatsapp' AND c.status IN ('queued','sending')
 AND (d.status='pending' OR (d.status='sending' AND d.reserved_at<now()-interval '10 minutes'))
 ORDER BY d.created_at,d.id LIMIT 1 FOR UPDATE OF d SKIP LOCKED;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.marketing_deliveries SET status='sending',reserved_at=now() WHERE id=v_id;
 UPDATE public.marketing_campaigns SET status='sending' WHERE id=p_campaign AND status='queued';
 RETURN QUERY SELECT d.id,(u.raw_user_meta_data->>'whatsapp')::text,c.body_text,c.template_name,c.template_language
 FROM public.marketing_deliveries d JOIN public.marketing_campaigns c ON c.id=d.campaign_id
 JOIN auth.users u ON u.id=d.customer_id WHERE d.id=v_id;
END $$;
REVOKE ALL ON FUNCTION public.claim_whatsapp_delivery(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_delivery(uuid) TO lp_auth;


-- El comerciante puede seguir editando su borrador, pero no reescribir envíos contabilizados.
DROP POLICY IF EXISTS campaigns_update_draft ON public.marketing_campaigns;
CREATE POLICY campaigns_update_draft ON public.marketing_campaigns
 FOR UPDATE TO authenticated
 USING (status='draft' AND public.is_business_manager(business_id))
 WITH CHECK(status='draft' AND public.is_business_manager(business_id));
