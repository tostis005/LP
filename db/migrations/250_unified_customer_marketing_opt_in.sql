-- Una sola aceptación explícita de ofertas para los tres canales enumerados.
-- No altera preferencias previas cuando un cliente se inscribe sin aceptar campañas.
-- Los canales siguen almacenándose por separado para facilitar la baja individual.
CREATE OR REPLACE FUNCTION public.join_program_with_notifications(
 p_business uuid,p_opted_in boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 IF p_opted_in IS NULL THEN RAISE EXCEPTION 'Selecciona una preferencia de notificaciones válida'; END IF;
 IF p_opted_in AND NOT EXISTS(
  SELECT 1 FROM auth.users u
  WHERE u.id=auth.uid() AND u.raw_user_meta_data->>'whatsapp' ~ '^\+[1-9][0-9]{7,14}$'
 ) THEN
  RAISE EXCEPTION 'Añade un número de WhatsApp con prefijo internacional para activar los tres canales';
 END IF;
 -- La función original protege el alta: solo clientes y negocios publicados.
 v_id:=public.join_program(p_business);
 IF p_opted_in THEN
  INSERT INTO public.marketing_consents(
   customer_id,business_id,opted_in,whatsapp_opted_in,push_opted_in
  ) VALUES(auth.uid(),p_business,true,true,true)
  ON CONFLICT (customer_id,business_id) WHERE business_id IS NOT NULL
  DO UPDATE SET opted_in=true,whatsapp_opted_in=true,push_opted_in=true,updated_at=now();
 END IF;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.join_program_with_notifications(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.join_program_with_notifications(uuid,boolean) TO authenticated;
