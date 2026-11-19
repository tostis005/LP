-- Moneda pactada por negocio. Todos los canales comparten la misma moneda.
ALTER TABLE public.business_marketing_rates DROP CONSTRAINT IF EXISTS business_marketing_rates_currency_check;
ALTER TABLE public.business_marketing_rates
 ADD CONSTRAINT business_marketing_rates_currency_check
 CHECK(currency IN('MXN','EUR','USD','GBP','CAD','BRL','ARS','COP','CLP','PEN','UYU','CRC','GTQ','DOP','HNL','NIO','PYG','BOB'));
ALTER TABLE public.push_usage_ledger DROP CONSTRAINT IF EXISTS push_usage_ledger_currency_check;
ALTER TABLE public.push_usage_ledger
 ADD CONSTRAINT push_usage_ledger_currency_check
 CHECK(currency IN('MXN','EUR','USD','GBP','CAD','BRL','ARS','COP','CLP','PEN','UYU','CRC','GTQ','DOP','HNL','NIO','PYG','BOB'));

-- Push se puede preparar como borrador, igual que email o WhatsApp.
ALTER TABLE public.push_campaigns DROP CONSTRAINT IF EXISTS push_campaigns_status_check;
ALTER TABLE public.push_campaigns ADD CONSTRAINT push_campaigns_status_check
 CHECK(status IN('draft','queued','sending','sent','partial','failed'));

CREATE OR REPLACE FUNCTION public.business_save_push_campaign(
 p_business uuid,p_title text,p_body text,p_campaign uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT public.is_business_manager(p_business) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 IF length(trim(p_title)) NOT BETWEEN 3 AND 120 OR length(trim(p_body)) NOT BETWEEN 3 AND 500
 THEN RAISE EXCEPTION 'Completa el título y el mensaje'; END IF;
 IF p_campaign IS NULL THEN
  INSERT INTO public.push_campaigns(business_id,created_by,title,body_text,status)
  VALUES(p_business,auth.uid(),trim(p_title),trim(p_body),'draft')
  RETURNING id INTO v_id;
 ELSE
  UPDATE public.push_campaigns SET title=trim(p_title),body_text=trim(p_body)
  WHERE id=p_campaign AND business_id=p_business AND status='draft' RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'La campaña ya no puede editarse'; END IF;
 END IF;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.business_save_push_campaign(uuid,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_save_push_campaign(uuid,text,text,uuid) TO authenticated;

-- Tarificar por PERSONA contactada, aunque la persona tenga varios dispositivos.
-- Los históricos de uso permanecen intactos.
ALTER TABLE public.push_usage_ledger ADD COLUMN IF NOT EXISTS customer_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS push_usage_per_person_idx
 ON public.push_usage_ledger(campaign_id,customer_id) WHERE customer_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.business_push_quote(p_business uuid)
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count bigint;
BEGIN
 IF NOT (public.is_business_manager(p_business) OR public.is_platform_admin())
 THEN RAISE EXCEPTION 'No autorizado'; END IF;
 SELECT count(DISTINCT m.customer_id) INTO v_count
 FROM public.loyalty_memberships m
 JOIN public.marketing_consents c ON c.customer_id=m.customer_id AND c.business_id=m.business_id AND c.push_opted_in
 JOIN public.web_push_subscriptions s ON s.customer_id=m.customer_id AND s.active
 WHERE m.business_id=p_business;
 RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.business_queue_push_campaign(p_campaign uuid,p_expected_total_cents bigint)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_c public.push_campaigns%rowtype;v_price integer;v_currency text;v_people integer;
BEGIN
 SELECT * INTO v_c FROM public.push_campaigns WHERE id=p_campaign FOR UPDATE;
 IF NOT FOUND OR NOT public.is_business_manager(v_c.business_id) THEN
  RAISE EXCEPTION 'No autorizado'; END IF;
 IF v_c.status<>'draft' THEN RAISE EXCEPTION 'La campaña ya está en proceso'; END IF;
 SELECT push_price_cents,currency INTO v_price,v_currency
 FROM public.business_marketing_rates WHERE business_id=v_c.business_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'La tarifa de notificaciones no está configurada'; END IF;
 INSERT INTO public.push_deliveries(campaign_id,subscription_id,customer_id,price_cents,currency)
 SELECT v_c.id,s.id,s.customer_id,v_price,v_currency
 FROM public.web_push_subscriptions s
 JOIN public.loyalty_memberships m ON m.customer_id=s.customer_id AND m.business_id=v_c.business_id
 JOIN public.marketing_consents c ON c.customer_id=s.customer_id AND c.business_id=v_c.business_id AND c.push_opted_in
 WHERE s.active ON CONFLICT DO NOTHING;
 SELECT count(DISTINCT customer_id)::integer INTO v_people
 FROM public.push_deliveries WHERE campaign_id=v_c.id;
 IF v_people=0 THEN RAISE EXCEPTION 'No hay clientes que hayan autorizado estas notificaciones'; END IF;
 IF p_expected_total_cents IS DISTINCT FROM v_people::bigint*v_price
 THEN RAISE EXCEPTION 'El importe ha cambiado. Revisa el presupuesto antes de enviarla'; END IF;
 UPDATE public.push_campaigns SET status='queued',recipient_count=v_people,
  total_cents=v_people::bigint*v_price,currency=v_currency WHERE id=v_c.id;
 RETURN v_people;
END $$;
REVOKE ALL ON FUNCTION public.business_queue_push_campaign(uuid,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_queue_push_campaign(uuid,bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.business_push_campaigns_unified(p_business uuid)
RETURNS TABLE(id uuid,subject text,body_text text,channel text,status text,recipient_count integer,
 sent_count integer,failed_count integer,created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT (public.is_business_manager(p_business) OR public.is_platform_admin()) THEN
  RAISE EXCEPTION 'No autorizado'; END IF;
 RETURN QUERY SELECT c.id,c.title,c.body_text,'push'::text,c.status,
  c.recipient_count,c.sent_count,c.failed_count,c.created_at
 FROM public.push_campaigns c WHERE c.business_id=p_business
 ORDER BY c.created_at DESC LIMIT 100;
END $$;
REVOKE ALL ON FUNCTION public.business_push_campaigns_unified(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_push_campaigns_unified(uuid) TO authenticated;

-- Contabilización única por persona, nunca por cada dispositivo.
CREATE OR REPLACE FUNCTION public.finish_push_delivery(p_delivery uuid,p_success boolean,p_expired boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_campaign uuid;v_subscription uuid;v_pending bigint;v_sent bigint;v_failed bigint;
BEGIN
 SELECT campaign_id,subscription_id INTO v_campaign,v_subscription FROM public.push_deliveries
 WHERE id=p_delivery AND status='sending' FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.push_deliveries SET status=CASE WHEN p_success THEN 'sent' ELSE 'failed' END,
 reserved_at=NULL,sent_at=CASE WHEN p_success THEN now() ELSE NULL END WHERE id=p_delivery;
 IF p_success THEN
  INSERT INTO public.push_usage_ledger(delivery_id,campaign_id,business_id,customer_id,price_cents,currency)
  SELECT d.id,d.campaign_id,c.business_id,d.customer_id,d.price_cents,d.currency
  FROM public.push_deliveries d JOIN public.push_campaigns c ON c.id=d.campaign_id
  WHERE d.id=p_delivery ON CONFLICT DO NOTHING;
 END IF;
 IF p_expired THEN
  UPDATE public.web_push_subscriptions SET active=false,updated_at=now() WHERE id=v_subscription;
 END IF;
 SELECT count(*) FILTER(WHERE status IN('pending','sending')),
 count(*) FILTER(WHERE status='sent'),count(*) FILTER(WHERE status='failed')
 INTO v_pending,v_sent,v_failed FROM public.push_deliveries WHERE campaign_id=v_campaign;
 UPDATE public.push_campaigns SET sent_count=v_sent,failed_count=v_failed,
  status=CASE WHEN v_pending>0 THEN 'sending' WHEN v_failed=0 THEN 'sent'
   WHEN v_sent=0 THEN 'failed' ELSE 'partial' END WHERE id=v_campaign;
END $$;
REVOKE ALL ON FUNCTION public.finish_push_delivery(uuid,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_push_delivery(uuid,boolean,boolean) TO lp_auth;

-- Mismo extracto para email, WhatsApp y push.
CREATE OR REPLACE FUNCTION public.business_marketing_usage(p_business uuid)
RETURNS TABLE(channel text,messages bigint,amount_cents bigint,currency text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT (public.is_business_manager(p_business) OR public.is_platform_admin())
 THEN RAISE EXCEPTION 'No autorizado'; END IF;
 RETURN QUERY
 SELECT c.channel::text,count(*)::bigint,coalesce(sum(l.price_cents),0)::bigint,l.currency::text
 FROM public.marketing_usage_ledger l JOIN public.marketing_campaigns c ON c.id=l.campaign_id
 WHERE l.business_id=p_business GROUP BY c.channel,l.currency
 UNION ALL
 SELECT 'push'::text,count(*)::bigint,coalesce(sum(l.price_cents),0)::bigint,l.currency::text
 FROM public.push_usage_ledger l WHERE l.business_id=p_business GROUP BY l.currency;
END $$;

-- Compatibilidad: cualquier integración antigua usa también la aprobación y el
-- precio por cliente del nuevo sistema.
CREATE OR REPLACE FUNCTION public.business_create_push_campaign(
 p_business uuid,p_title text,p_body text,p_expected_total_cents bigint
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 v_id:=public.business_save_push_campaign(p_business,p_title,p_body,NULL);
 PERFORM public.business_queue_push_campaign(v_id,p_expected_total_cents);
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.business_create_push_campaign(uuid,text,text,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_create_push_campaign(uuid,text,text,bigint) TO authenticated;
