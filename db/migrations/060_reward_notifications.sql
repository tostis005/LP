-- Entrega de avisos de premio: el servicio auth solo accede vía funciones acotadas.
-- Se reserva un envío durante 10 minutos para evitar mensajes duplicados por concurrencia.
CREATE OR REPLACE FUNCTION public.claim_reward_notification(p_card_token uuid)
RETURNS TABLE(token uuid,email text,business_name text,reward_label text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 SELECT v.id INTO v_id
 FROM public.reward_vouchers v
 JOIN public.loyalty_memberships m ON m.id=v.membership_id
 WHERE m.card_token=p_card_token AND v.status='issued' AND v.email_sent_at IS NULL
   AND (v.email_reserved_at IS NULL OR v.email_reserved_at<now()-interval '10 minutes')
 ORDER BY v.issued_at LIMIT 1 FOR UPDATE OF v SKIP LOCKED;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.reward_vouchers SET email_reserved_at=now() WHERE id=v_id;
 RETURN QUERY SELECT v.token,u.email::text,b.name::text,v.reward_label
 FROM public.reward_vouchers v
 JOIN public.loyalty_memberships m ON m.id=v.membership_id
 JOIN public.businesses b ON b.id=v.business_id
 JOIN auth.users u ON u.id=m.customer_id AND u.email_confirmed_at IS NOT NULL
 WHERE v.id=v_id;
END $$;

CREATE OR REPLACE FUNCTION public.finish_reward_notification(p_token uuid,p_success boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.reward_vouchers
 SET email_sent_at=CASE WHEN p_success THEN now() ELSE email_sent_at END,
     email_reserved_at=NULL
 WHERE token=p_token AND status='issued' AND email_reserved_at IS NOT NULL;
END $$;

REVOKE ALL ON FUNCTION public.claim_reward_notification(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_reward_notification(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reward_notification(uuid) TO lp_auth;
GRANT EXECUTE ON FUNCTION public.finish_reward_notification(uuid,boolean) TO lp_auth;
