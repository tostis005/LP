-- Consentimiento comercial de Loyally al verificar una cuenta nueva.
-- Nunca se presupone: solo se materializa cuando el usuario marcó explícitamente
-- la casilla del formulario de registro. No afecta a los permisos de cada negocio.
CREATE OR REPLACE FUNCTION public.confirm_initial_platform_marketing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL
    AND NEW.raw_user_meta_data->>'platform_marketing_opt_in'='true' THEN
  INSERT INTO public.marketing_consents(customer_id,business_id,opted_in)
  VALUES(NEW.id,NULL,true)
  ON CONFLICT(customer_id) WHERE business_id IS NULL DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_confirm_initial_platform_marketing ON auth.users;
CREATE TRIGGER trg_confirm_initial_platform_marketing
 AFTER UPDATE OF email_confirmed_at ON auth.users
 FOR EACH ROW EXECUTE FUNCTION public.confirm_initial_platform_marketing();
