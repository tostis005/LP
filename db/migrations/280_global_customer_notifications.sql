-- Permiso comercial global: se decide una vez y se aplica a tarjetas presentes y futuras.
-- NULL = todavía no decidido. No se activan permisos antiguos de forma implícita.
ALTER TABLE public.marketing_consents
 ADD COLUMN IF NOT EXISTS global_business_opt_in boolean;

CREATE OR REPLACE FUNCTION public.customer_set_all_notifications(p_opted_in boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR p_opted_in IS NULL THEN
  RAISE EXCEPTION 'Inicia sesión para gestionar tus avisos';
 END IF;
 IF p_opted_in AND NOT EXISTS(
  SELECT 1 FROM auth.users u WHERE u.id=auth.uid()
    AND u.raw_user_meta_data->>'whatsapp' ~ '^\+[1-9][0-9]{7,14}$'
 ) THEN RAISE EXCEPTION 'Añade tu número de WhatsApp con prefijo internacional'; END IF;
 INSERT INTO public.marketing_consents(
  customer_id,business_id,opted_in,whatsapp_opted_in,push_opted_in,global_business_opt_in
 ) VALUES(auth.uid(),NULL,false,false,false,p_opted_in)
 ON CONFLICT(customer_id) WHERE business_id IS NULL
 DO UPDATE SET global_business_opt_in=EXCLUDED.global_business_opt_in,updated_at=now();
 INSERT INTO public.marketing_consents(
  customer_id,business_id,opted_in,whatsapp_opted_in,push_opted_in
 )
 SELECT auth.uid(),m.business_id,p_opted_in,p_opted_in,p_opted_in
 FROM public.loyalty_memberships m WHERE m.customer_id=auth.uid()
 ON CONFLICT(customer_id,business_id) WHERE business_id IS NOT NULL
 DO UPDATE SET opted_in=EXCLUDED.opted_in,
  whatsapp_opted_in=EXCLUDED.whatsapp_opted_in,
  push_opted_in=EXCLUDED.push_opted_in,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.customer_set_all_notifications(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.customer_set_all_notifications(boolean) TO authenticated;

-- El alta respeta la decisión inicial. En nuevas tarjetas hereda el ajuste general
-- sin reactivar canales desactivados individualmente en tarjetas anteriores.
CREATE OR REPLACE FUNCTION public.join_program_with_notifications(
 p_business uuid,p_opted_in boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;v_global boolean;v_signup boolean;
BEGIN
 IF p_opted_in IS NULL THEN RAISE EXCEPTION 'Selecciona una preferencia válida'; END IF;
 v_id:=public.join_program(p_business);
 SELECT c.global_business_opt_in INTO v_global FROM public.marketing_consents c
 WHERE c.customer_id=auth.uid() AND c.business_id IS NULL;
 IF v_global IS NULL THEN
  SELECT CASE WHEN u.raw_user_meta_data ? 'card_notifications_opt_in'
              THEN (u.raw_user_meta_data->>'card_notifications_opt_in')::boolean
              ELSE NULL END INTO v_signup
  FROM auth.users u WHERE u.id=auth.uid();
  IF v_signup IS NOT NULL THEN
   v_global:=v_signup;
   INSERT INTO public.marketing_consents(
    customer_id,business_id,opted_in,push_opted_in,global_business_opt_in
   ) VALUES(auth.uid(),NULL,false,false,v_global)
   ON CONFLICT(customer_id) WHERE business_id IS NULL
   DO UPDATE SET global_business_opt_in=EXCLUDED.global_business_opt_in,updated_at=now();
  ELSIF p_opted_in THEN
   PERFORM public.customer_set_all_notifications(true);
   v_global:=true;
  ELSE
   v_global:=false;
   INSERT INTO public.marketing_consents(
    customer_id,business_id,opted_in,push_opted_in,global_business_opt_in
   ) VALUES(auth.uid(),NULL,false,false,false)
   ON CONFLICT(customer_id) WHERE business_id IS NULL
   DO UPDATE SET global_business_opt_in=false,updated_at=now();
  END IF;
 END IF;
 IF v_global THEN
  INSERT INTO public.marketing_consents(
   customer_id,business_id,opted_in,whatsapp_opted_in,push_opted_in
  ) VALUES(auth.uid(),p_business,true,true,true)
  ON CONFLICT(customer_id,business_id) WHERE business_id IS NOT NULL DO NOTHING;
 END IF;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.join_program_with_notifications(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.join_program_with_notifications(uuid,boolean) TO authenticated;

-- Registro: la única casilla elegida se conserva al verificar el correo,
-- sin revocar nunca cambios que el usuario haya hecho posteriormente.
CREATE OR REPLACE FUNCTION public.confirm_initial_platform_marketing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
  IF NEW.raw_user_meta_data ? 'card_notifications_opt_in' THEN
   INSERT INTO public.marketing_consents(
    customer_id,business_id,opted_in,push_opted_in,global_business_opt_in
   ) VALUES(
    NEW.id,NULL,
    NEW.raw_user_meta_data->>'platform_marketing_opt_in'='true',
    NEW.raw_user_meta_data->>'platform_push_opt_in'='true',
    NEW.raw_user_meta_data->>'card_notifications_opt_in'='true'
   )
   ON CONFLICT(customer_id) WHERE business_id IS NULL DO NOTHING;
  ELSIF NEW.raw_user_meta_data->>'platform_marketing_opt_in'='true'
     OR NEW.raw_user_meta_data->>'platform_push_opt_in'='true' THEN
   INSERT INTO public.marketing_consents(customer_id,business_id,opted_in,push_opted_in)
   VALUES(NEW.id,NULL,
    NEW.raw_user_meta_data->>'platform_marketing_opt_in'='true',
    NEW.raw_user_meta_data->>'platform_push_opt_in'='true')
   ON CONFLICT(customer_id) WHERE business_id IS NULL DO NOTHING;
  END IF;
 END IF;
 RETURN NEW;
END $$;
