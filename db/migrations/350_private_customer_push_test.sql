-- Permitir al cliente probar exclusivamente su propia suscripción registrada.
-- La tabla contiene claves privadas de suscripción: nunca conceder SELECT directo.
CREATE OR REPLACE FUNCTION public.customer_push_subscription(p_endpoint text)
RETURNS TABLE(endpoint text,p256dh text,auth text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT s.endpoint,s.p256dh,s.auth
 FROM public.web_push_subscriptions s
 WHERE s.customer_id=auth.uid() AND s.endpoint=p_endpoint AND s.active
 LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.customer_push_subscription(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.customer_push_subscription(text) TO authenticated;
