-- Web Push: permisos independientes por negocio, dispositivos privados y colas por dispositivo.
-- Las claves de suscripción no son visibles a comerciantes ni a clientes ajenos.
ALTER TABLE public.marketing_consents
 ADD COLUMN IF NOT EXISTS push_opted_in boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 endpoint text NOT NULL UNIQUE CHECK (length(endpoint) BETWEEN 20 AND 2048),
 p256dh text NOT NULL CHECK (length(p256dh) BETWEEN 40 AND 256),
 auth text NOT NULL CHECK (length(auth) BETWEEN 16 AND 256),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS web_push_subscriptions_customer_idx
 ON public.web_push_subscriptions(customer_id) WHERE active;
ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.push_campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 title text NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
 body_text text NOT NULL CHECK (length(body_text) BETWEEN 3 AND 500),
 status text NOT NULL DEFAULT 'queued'
  CHECK (status IN ('queued','sending','sent','partial','failed')),
 recipient_count integer NOT NULL DEFAULT 0,
 sent_count integer NOT NULL DEFAULT 0,
 failed_count integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_campaigns_business_idx
 ON public.push_campaigns(business_id,created_at DESC);
ALTER TABLE public.push_campaigns ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.push_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 campaign_id uuid NOT NULL REFERENCES public.push_campaigns(id) ON DELETE CASCADE,
 subscription_id uuid NOT NULL REFERENCES public.web_push_subscriptions(id) ON DELETE CASCADE,
 customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending','sending','sent','failed')),
 reserved_at timestamptz,
 sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(campaign_id,subscription_id)
);
CREATE INDEX IF NOT EXISTS push_deliveries_queue_idx ON public.push_deliveries(campaign_id,status);
ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;

-- El cliente solo ve las preferencias de negocios donde tiene tarjeta.
CREATE OR REPLACE FUNCTION public.customer_push_preferences()
RETURNS TABLE(business_id uuid,business_name text,opted_in boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Necesitas iniciar sesión'; END IF;
 RETURN QUERY
 SELECT m.business_id,b.name::text,coalesce(c.push_opted_in,false)
 FROM public.loyalty_memberships m
 JOIN public.businesses b ON b.id=m.business_id
 LEFT JOIN public.marketing_consents c
  ON c.customer_id=m.customer_id AND c.business_id=m.business_id
 WHERE m.customer_id=auth.uid()
 ORDER BY b.name;
END $$;
REVOKE ALL ON FUNCTION public.customer_push_preferences() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.customer_push_preferences() TO authenticated;

CREATE OR REPLACE FUNCTION public.customer_set_push_consent(p_business uuid,p_opted_in boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.loyalty_memberships m
  WHERE m.business_id=p_business AND m.customer_id=auth.uid()
 ) THEN RAISE EXCEPTION 'Solo puedes gestionar notificaciones de tus tarjetas'; END IF;
 INSERT INTO public.marketing_consents(customer_id,business_id,opted_in,push_opted_in)
 VALUES(auth.uid(),p_business,false,p_opted_in)
 ON CONFLICT (customer_id,business_id) WHERE business_id IS NOT NULL
 DO UPDATE SET push_opted_in=EXCLUDED.push_opted_in,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.customer_set_push_consent(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.customer_set_push_consent(uuid,boolean) TO authenticated;

-- Solo el backend autenticado registra/retira endpoints; nunca se exponen a RLS.
CREATE OR REPLACE FUNCTION public.register_web_push_subscription(
 p_customer uuid,p_endpoint text,p_p256dh text,p_auth text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_customer IS NULL OR length(p_endpoint) NOT BETWEEN 20 AND 2048
 OR length(p_p256dh) NOT BETWEEN 40 AND 256 OR length(p_auth) NOT BETWEEN 16 AND 256
 THEN RAISE EXCEPTION 'Suscripción inválida'; END IF;
 INSERT INTO public.web_push_subscriptions(customer_id,endpoint,p256dh,auth)
 VALUES(p_customer,p_endpoint,p_p256dh,p_auth)
 ON CONFLICT(endpoint) DO UPDATE
 SET customer_id=EXCLUDED.customer_id,p256dh=EXCLUDED.p256dh,auth=EXCLUDED.auth,
 active=true,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.register_web_push_subscription(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_web_push_subscription(uuid,text,text,text) TO lp_auth;

CREATE OR REPLACE FUNCTION public.unregister_web_push_subscription(p_customer uuid,p_endpoint text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE public.web_push_subscriptions SET active=false,updated_at=now()
 WHERE customer_id=p_customer AND endpoint=p_endpoint;
$$;
REVOKE ALL ON FUNCTION public.unregister_web_push_subscription(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_web_push_subscription(uuid,text) TO lp_auth;

CREATE OR REPLACE FUNCTION public.business_push_quote(p_business uuid)
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count bigint;
BEGIN
 IF NOT (public.is_business_manager(p_business) OR public.is_platform_admin())
 THEN RAISE EXCEPTION 'No autorizado'; END IF;
 SELECT count(*) INTO v_count
 FROM public.web_push_subscriptions s
 JOIN public.loyalty_memberships m ON m.customer_id=s.customer_id AND m.business_id=p_business
 JOIN public.marketing_consents c ON c.customer_id=s.customer_id
  AND c.business_id=p_business AND c.push_opted_in
 WHERE s.active;
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.business_push_quote(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_push_quote(uuid) TO authenticated;

-- Crea y congela el público de la campaña, exclusivamente dispositivos con consentimiento.
CREATE OR REPLACE FUNCTION public.business_create_push_campaign(
 p_business uuid,p_title text,p_body text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;v_count integer;
BEGIN
 IF NOT (public.is_business_manager(p_business) OR public.is_platform_admin())
 THEN RAISE EXCEPTION 'No autorizado'; END IF;
 IF length(trim(p_title)) NOT BETWEEN 3 AND 120 OR length(trim(p_body)) NOT BETWEEN 3 AND 500
 THEN RAISE EXCEPTION 'Título o mensaje fuera de los límites'; END IF;
 INSERT INTO public.push_campaigns(business_id,created_by,title,body_text)
 VALUES(p_business,auth.uid(),trim(p_title),trim(p_body)) RETURNING id INTO v_id;
 INSERT INTO public.push_deliveries(campaign_id,subscription_id,customer_id)
 SELECT v_id,s.id,s.customer_id FROM public.web_push_subscriptions s
 JOIN public.loyalty_memberships m ON m.customer_id=s.customer_id AND m.business_id=p_business
 JOIN public.marketing_consents c ON c.customer_id=s.customer_id
  AND c.business_id=p_business AND c.push_opted_in
 WHERE s.active
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count=0 THEN RAISE EXCEPTION 'No hay dispositivos con consentimiento push para este negocio'; END IF;
 UPDATE public.push_campaigns SET recipient_count=v_count WHERE id=v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.business_create_push_campaign(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_create_push_campaign(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.business_push_campaigns(p_business uuid)
RETURNS TABLE(id uuid,title text,status text,recipient_count integer,sent_count integer,
 failed_count integer,created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT (public.is_business_manager(p_business) OR public.is_platform_admin())
 THEN RAISE EXCEPTION 'No autorizado'; END IF;
 RETURN QUERY SELECT p.id,p.title,p.status,p.recipient_count,p.sent_count,p.failed_count,p.created_at
 FROM public.push_campaigns p WHERE p.business_id=p_business
 ORDER BY p.created_at DESC LIMIT 50;
END $$;
REVOKE ALL ON FUNCTION public.business_push_campaigns(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_push_campaigns(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.business_can_send_push_campaign(p_campaign uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(
  SELECT 1 FROM public.push_campaigns p WHERE p.id=p_campaign
   AND (public.is_business_manager(p.business_id) OR public.is_platform_admin())
 );
$$;
REVOKE ALL ON FUNCTION public.business_can_send_push_campaign(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_can_send_push_campaign(uuid) TO authenticated;

-- Cola privada: se vuelven a validar la suscripción, la tarjeta y el consentimiento al enviar.
CREATE OR REPLACE FUNCTION public.claim_push_delivery(p_campaign uuid)
RETURNS TABLE(delivery_id uuid,endpoint text,p256dh text,auth text,title text,body_text text,
 business_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 UPDATE public.push_deliveries d SET status='failed',reserved_at=NULL
 WHERE d.campaign_id=p_campaign AND d.status IN('pending','sending') AND NOT EXISTS(
  SELECT 1 FROM public.web_push_subscriptions s
  JOIN public.push_campaigns p ON p.id=p_campaign
  JOIN public.loyalty_memberships m ON m.customer_id=s.customer_id AND m.business_id=p.business_id
  JOIN public.marketing_consents c ON c.customer_id=s.customer_id AND c.business_id=p.business_id
  WHERE s.id=d.subscription_id AND s.customer_id=d.customer_id AND s.active AND c.push_opted_in
 );
 SELECT d.id INTO v_id FROM public.push_deliveries d
 JOIN public.push_campaigns p ON p.id=d.campaign_id
 WHERE d.campaign_id=p_campaign AND p.status IN('queued','sending')
 AND (d.status='pending' OR (d.status='sending' AND d.reserved_at<now()-interval '10 minutes'))
 ORDER BY d.created_at,d.id LIMIT 1 FOR UPDATE OF d SKIP LOCKED;
 IF NOT FOUND THEN
  UPDATE public.push_campaigns p SET
   sent_count=(SELECT count(*) FROM public.push_deliveries d WHERE d.campaign_id=p.id AND d.status='sent'),
   failed_count=(SELECT count(*) FROM public.push_deliveries d WHERE d.campaign_id=p.id AND d.status='failed'),
   status=CASE
    WHEN EXISTS(SELECT 1 FROM public.push_deliveries d WHERE d.campaign_id=p.id AND d.status IN('pending','sending')) THEN 'sending'
    WHEN EXISTS(SELECT 1 FROM public.push_deliveries d WHERE d.campaign_id=p.id AND d.status='failed')
      THEN CASE WHEN EXISTS(SELECT 1 FROM public.push_deliveries d WHERE d.campaign_id=p.id AND d.status='sent') THEN 'partial' ELSE 'failed' END
    ELSE 'sent' END
  WHERE p.id=p_campaign AND p.status IN ('queued','sending');
  RETURN;
 END IF;
 UPDATE public.push_deliveries SET status='sending',reserved_at=now() WHERE id=v_id;
 UPDATE public.push_campaigns SET status='sending' WHERE id=p_campaign AND status='queued';
 RETURN QUERY SELECT d.id,s.endpoint,s.p256dh,s.auth,p.title,p.body_text,b.name
 FROM public.push_deliveries d
 JOIN public.web_push_subscriptions s ON s.id=d.subscription_id
 JOIN public.push_campaigns p ON p.id=d.campaign_id
 JOIN public.businesses b ON b.id=p.business_id
 WHERE d.id=v_id;
END $$;
REVOKE ALL ON FUNCTION public.claim_push_delivery(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_delivery(uuid) TO lp_auth;

CREATE OR REPLACE FUNCTION public.finish_push_delivery(p_delivery uuid,p_success boolean,p_expired boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_campaign uuid;v_subscription uuid;v_pending bigint;v_sent bigint;v_failed bigint;
BEGIN
 SELECT campaign_id,subscription_id INTO v_campaign,v_subscription
 FROM public.push_deliveries WHERE id=p_delivery AND status='sending' FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.push_deliveries SET status=CASE WHEN p_success THEN 'sent' ELSE 'failed' END,
 reserved_at=NULL,sent_at=CASE WHEN p_success THEN now() ELSE NULL END WHERE id=p_delivery;
 IF p_expired THEN
  UPDATE public.web_push_subscriptions SET active=false,updated_at=now() WHERE id=v_subscription;
 END IF;
 SELECT count(*) FILTER(WHERE status IN('pending','sending')),
 count(*) FILTER(WHERE status='sent'),count(*) FILTER(WHERE status='failed')
 INTO v_pending,v_sent,v_failed FROM public.push_deliveries WHERE campaign_id=v_campaign;
 UPDATE public.push_campaigns SET sent_count=v_sent,failed_count=v_failed,
  status=CASE WHEN v_pending>0 THEN 'sending' WHEN v_failed=0 THEN 'sent'
    WHEN v_sent=0 THEN 'failed' ELSE 'partial' END
 WHERE id=v_campaign;
END $$;
REVOKE ALL ON FUNCTION public.finish_push_delivery(uuid,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_push_delivery(uuid,boolean,boolean) TO lp_auth;
