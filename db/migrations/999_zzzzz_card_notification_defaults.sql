-- El alta de una tarjeta guarda los canales elegidos sin reactivar bajas de otras tarjetas.
-- Una preferencia de WhatsApp no sustituye al número válido ni al permiso de entrega.
CREATE OR REPLACE FUNCTION public.join_program_with_notifications(
 p_business uuid,p_opted_in boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;v_global boolean;v_signup boolean;v_existing boolean;
BEGIN
 IF p_opted_in IS NULL THEN RAISE EXCEPTION 'Selecciona una preferencia válida'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.loyalty_memberships m
  WHERE m.customer_id=auth.uid() AND m.business_id=p_business) INTO v_existing;
 v_id:=public.join_program(p_business);
 -- Repetir el alta nunca modifica una preferencia guardada.
 IF v_existing THEN RETURN v_id; END IF;
 SELECT c.global_business_opt_in INTO v_global FROM public.marketing_consents c
 WHERE c.customer_id=auth.uid() AND c.business_id IS NULL;
 IF v_global IS NULL THEN
  SELECT CASE WHEN u.raw_user_meta_data->>'card_notifications_opt_in'='true' THEN true
              WHEN u.raw_user_meta_data->>'card_notifications_opt_in'='false' THEN false
              ELSE NULL END INTO v_signup
  FROM auth.users u WHERE u.id=auth.uid();
  -- Un primer alta no concede permisos comerciales sobre otras tarjetas.
  -- Solo se conserva una decisión global previa o el rechazo inicial.
  IF v_signup IS NOT NULL OR NOT p_opted_in THEN
   INSERT INTO public.marketing_consents(
    customer_id,business_id,opted_in,whatsapp_opted_in,push_opted_in,global_business_opt_in
   ) VALUES(auth.uid(),NULL,false,false,false,coalesce(v_signup,false))
   ON CONFLICT(customer_id) WHERE business_id IS NULL
   DO UPDATE SET global_business_opt_in=EXCLUDED.global_business_opt_in,updated_at=now()
   WHERE public.marketing_consents.global_business_opt_in IS NULL;
  END IF;
 END IF;
 IF p_opted_in THEN
  INSERT INTO public.marketing_consents(
   customer_id,business_id,opted_in,whatsapp_opted_in,push_opted_in
  ) VALUES(auth.uid(),p_business,true,true,true)
  ON CONFLICT(customer_id,business_id) WHERE business_id IS NOT NULL DO NOTHING;
 END IF;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.join_program_with_notifications(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.join_program_with_notifications(uuid,boolean) TO authenticated;

-- Reparar exclusivamente altas que carecen de fila de preferencias y ya tenían
-- un permiso global afirmativo. Las bajas individuales existentes quedan intactas.
INSERT INTO public.marketing_consents(customer_id,business_id,opted_in,whatsapp_opted_in,push_opted_in)
SELECT m.customer_id,m.business_id,true,true,true
FROM public.loyalty_memberships m
JOIN public.marketing_consents c ON c.customer_id=m.customer_id
 AND c.business_id IS NULL AND c.global_business_opt_in IS TRUE
WHERE c.updated_at<=m.created_at
AND NOT EXISTS(SELECT 1 FROM public.marketing_consents p
 WHERE p.customer_id=m.customer_id AND p.business_id=m.business_id)
ON CONFLICT(customer_id,business_id) WHERE business_id IS NOT NULL DO NOTHING;
