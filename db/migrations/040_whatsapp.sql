-- Número de WhatsApp opcional para recibir avisos transaccionales de recompensas.
-- Consentimiento publicitario independiente.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_whatsapp_format;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_whatsapp_format
 CHECK (whatsapp IS NULL OR whatsapp ~ '^\\+[1-9][0-9]{7,14}$');

CREATE OR REPLACE FUNCTION public.new_user_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.profiles(id,full_name,whatsapp)
 VALUES(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),
        nullif(new.raw_user_meta_data->>'whatsapp',''))
 ON CONFLICT(id) DO UPDATE SET
  full_name=excluded.full_name,
  whatsapp=coalesce(excluded.whatsapp,public.profiles.whatsapp);
 RETURN new;
END $$;
