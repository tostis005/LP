-- Preferencias opcionales e independientes de correo y push de Loyally.
-- Los permisos de negocios concretos se obtienen por separado al guardar cada tarjeta.
CREATE OR REPLACE FUNCTION public.confirm_initial_platform_marketing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL
    AND (NEW.raw_user_meta_data->>'platform_marketing_opt_in'='true'
      OR NEW.raw_user_meta_data->>'platform_push_opt_in'='true') THEN
  INSERT INTO public.marketing_consents(customer_id,business_id,opted_in,push_opted_in)
  VALUES(NEW.id,NULL,
   NEW.raw_user_meta_data->>'platform_marketing_opt_in'='true',
   NEW.raw_user_meta_data->>'platform_push_opt_in'='true')
  ON CONFLICT(customer_id) WHERE business_id IS NULL DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_confirm_initial_platform_marketing ON auth.users;
CREATE TRIGGER trg_confirm_initial_platform_marketing
 AFTER UPDATE OF email_confirmed_at ON auth.users
 FOR EACH ROW EXECUTE FUNCTION public.confirm_initial_platform_marketing();

CREATE OR REPLACE FUNCTION public.platform_upsert_push_consent(p_opted_in boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión para guardar tus preferencias'; END IF;
 INSERT INTO public.marketing_consents(customer_id,business_id,opted_in,push_opted_in)
 VALUES(auth.uid(),NULL,false,p_opted_in)
 ON CONFLICT(customer_id) WHERE business_id IS NULL
 DO UPDATE SET push_opted_in=EXCLUDED.push_opted_in,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.platform_upsert_push_consent(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_upsert_push_consent(boolean) TO authenticated;
