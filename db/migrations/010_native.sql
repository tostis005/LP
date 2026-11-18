-- Entrada segura de leads anónimos desde un servidor con privilegios limitados.
CREATE OR REPLACE FUNCTION public.submit_business_lead(
  p_business_name text,p_contact_name text,p_contact_email text,
  p_category text,p_city text,p_message text,p_consent boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT p_consent OR char_length(trim(p_business_name)) NOT BETWEEN 2 AND 120
    OR char_length(trim(p_contact_name)) NOT BETWEEN 2 AND 120
    OR char_length(trim(p_city)) NOT BETWEEN 2 AND 120
    OR char_length(trim(p_contact_email)) NOT BETWEEN 5 AND 254
    OR char_length(coalesce(p_message,'')) > 1000 THEN
    RAISE EXCEPTION 'Solicitud inválida';
  END IF;
  INSERT INTO public.business_leads(
    business_name,contact_name,contact_email,category,city,message,consent_contact
  ) VALUES(p_business_name,p_contact_name,p_contact_email,p_category,p_city,p_message,p_consent);
END; $$;
REVOKE ALL ON FUNCTION public.submit_business_lead(text,text,text,text,text,text,boolean) FROM PUBLIC;