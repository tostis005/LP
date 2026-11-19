-- Tarificación de Web Push por negocio (cliente comercial), en centavos del mismo
-- tipo de moneda que email y WhatsApp. Valor 0: envío gratuito.
ALTER TABLE public.business_marketing_rates
 ADD COLUMN IF NOT EXISTS push_price_cents integer NOT NULL DEFAULT 0
 CHECK (push_price_cents BETWEEN 0 AND 100000);

ALTER TABLE public.push_campaigns
 ADD COLUMN IF NOT EXISTS total_cents bigint NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'MXN';
ALTER TABLE public.push_deliveries
 ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'MXN';

CREATE TABLE IF NOT EXISTS public.push_usage_ledger (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 delivery_id uuid NOT NULL UNIQUE REFERENCES public.push_deliveries(id) ON DELETE CASCADE,
 campaign_id uuid NOT NULL REFERENCES public.push_campaigns(id) ON DELETE CASCADE,
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 price_cents integer NOT NULL CHECK(price_cents BETWEEN 0 AND 100000),
 currency text NOT NULL CHECK(currency IN ('MXN','EUR','USD')),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_usage_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_usage_manager_read ON public.push_usage_ledger;
CREATE POLICY push_usage_manager_read ON public.push_usage_ledger
 FOR SELECT TO authenticated
 USING(public.is_business_manager(business_id) OR public.is_platform_admin());
GRANT SELECT ON public.push_usage_ledger TO authenticated;

CREATE OR REPLACE FUNCTION public.business_push_pricing(p_business uuid)
RETURNS TABLE(devices bigint,price_cents integer,total_cents bigint,currency text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_devices bigint;v_price integer;v_currency text;
BEGIN
 IF NOT (public.is_business_manager(p_business) OR public.is_platform_admin())
 THEN RAISE EXCEPTION 'No autorizado'; END IF;
 v_devices:=public.business_push_quote(p_business);
 SELECT r.push_price_cents,r.currency INTO v_price,v_currency
 FROM public.business_marketing_rates r WHERE r.business_id=p_business;
 v_price:=coalesce(v_price,0);v_currency:=coalesce(v_currency,'MXN');
 RETURN QUERY SELECT v_devices,v_price,(v_devices*v_price)::bigint,v_currency;
END $$;
REVOKE ALL ON FUNCTION public.business_push_pricing(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_push_pricing(uuid) TO authenticated;

-- Desactivar firma antigua sin presupuesto. El backend siempre transmite
-- el total estimado y PostgreSQL lo valida dentro de la misma transacción.
DROP FUNCTION public.business_create_push_campaign(uuid,text,text);
CREATE FUNCTION public.business_create_push_campaign(
 p_business uuid,p_title text,p_body text,p_expected_total_cents bigint
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;v_count integer;v_price integer;v_currency text;
BEGIN
 IF NOT (public.is_business_manager(p_business) OR public.is_platform_admin())
 THEN RAISE EXCEPTION 'No autorizado'; END IF;
 IF length(trim(p_title)) NOT BETWEEN 3 AND 120 OR length(trim(p_body)) NOT BETWEEN 3 AND 500
 THEN RAISE EXCEPTION 'Título o mensaje fuera de los límites'; END IF;
 SELECT r.push_price_cents,r.currency INTO v_price,v_currency
 FROM public.business_marketing_rates r WHERE r.business_id=p_business FOR SHARE;
 v_price:=coalesce(v_price,0);v_currency:=coalesce(v_currency,'MXN');
 INSERT INTO public.push_campaigns(business_id,created_by,title,body_text,currency)
 VALUES(p_business,auth.uid(),trim(p_title),trim(p_body),v_currency) RETURNING id INTO v_id;
 INSERT INTO public.push_deliveries(campaign_id,subscription_id,customer_id,price_cents,currency)
 SELECT v_id,s.id,s.customer_id,v_price,v_currency FROM public.web_push_subscriptions s
 JOIN public.loyalty_memberships m ON m.customer_id=s.customer_id AND m.business_id=p_business
 JOIN public.marketing_consents c ON c.customer_id=s.customer_id
  AND c.business_id=p_business AND c.push_opted_in
 WHERE s.active
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count=0 THEN RAISE EXCEPTION 'No hay dispositivos con consentimiento push para este negocio'; END IF;
 IF p_expected_total_cents IS DISTINCT FROM v_count::bigint*v_price
 THEN RAISE EXCEPTION 'El presupuesto ha cambiado; actualiza el precio antes de confirmar'; END IF;
 UPDATE public.push_campaigns SET recipient_count=v_count,
  total_cents=v_count::bigint*v_price WHERE id=v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.business_create_push_campaign(uuid,text,text,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_create_push_campaign(uuid,text,text,bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.business_push_campaigns_priced(p_business uuid)
RETURNS TABLE(id uuid,title text,status text,recipient_count integer,sent_count integer,
 failed_count integer,total_cents bigint,currency text,created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT (public.is_business_manager(p_business) OR public.is_platform_admin())
 THEN RAISE EXCEPTION 'No autorizado'; END IF;
 RETURN QUERY
 SELECT c.id,c.title,c.status,c.recipient_count,c.sent_count,c.failed_count,
 c.total_cents,c.currency,c.created_at
 FROM public.push_campaigns c WHERE c.business_id=p_business
 ORDER BY c.created_at DESC LIMIT 50;
END $$;
REVOKE ALL ON FUNCTION public.business_push_campaigns_priced(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_push_campaigns_priced(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.business_push_usage(p_business uuid)
RETURNS TABLE(messages bigint,amount_cents bigint,currency text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT (public.is_business_manager(p_business) OR public.is_platform_admin())
 THEN RAISE EXCEPTION 'No autorizado'; END IF;
 RETURN QUERY SELECT count(*)::bigint,coalesce(sum(l.price_cents),0)::bigint,l.currency
 FROM public.push_usage_ledger l WHERE l.business_id=p_business
 GROUP BY l.currency;
END $$;
REVOKE ALL ON FUNCTION public.business_push_usage(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_push_usage(uuid) TO authenticated;

-- Se contabiliza solo cuando el proveedor push acepta la entrega. La clave
-- UNIQUE(delivery_id) impide duplicar un coste en reintentos.
CREATE OR REPLACE FUNCTION public.finish_push_delivery(p_delivery uuid,p_success boolean,p_expired boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_campaign uuid;v_subscription uuid;v_pending bigint;v_sent bigint;v_failed bigint;
BEGIN
 SELECT campaign_id,subscription_id INTO v_campaign,v_subscription
 FROM public.push_deliveries WHERE id=p_delivery AND status='sending' FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.push_deliveries SET status=CASE WHEN p_success THEN 'sent' ELSE 'failed' END,
 reserved_at=NULL,sent_at=CASE WHEN p_success THEN now() ELSE NULL END WHERE id=p_delivery;
 IF p_success THEN
  INSERT INTO public.push_usage_ledger(delivery_id,campaign_id,business_id,price_cents,currency)
  SELECT d.id,d.campaign_id,c.business_id,d.price_cents,d.currency
  FROM public.push_deliveries d JOIN public.push_campaigns c ON c.id=d.campaign_id
  WHERE d.id=p_delivery
  ON CONFLICT(delivery_id) DO NOTHING;
 END IF;
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
