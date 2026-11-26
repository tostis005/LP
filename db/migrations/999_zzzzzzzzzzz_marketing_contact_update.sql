-- Marketing may record contact outcomes only in its assigned areas.
CREATE FUNCTION public.crm_marketing_save_contact(target uuid,new_status text,new_notes text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 DECLARE prospect public.crm_prospects%ROWTYPE; address text;
 BEGIN
 IF NOT public.crm_marketing_active() OR new_status NOT IN ('pending_review','qualified','contacted','interested','trial','converted','discarded','do_not_contact') OR new_notes IS NULL OR length(new_notes)>2000 THEN RAISE EXCEPTION 'Operación no autorizada' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('crm-sendcorex-send'));
 SELECT * INTO prospect FROM public.crm_prospects WHERE id=target FOR UPDATE;
 IF NOT FOUND OR NOT public.crm_marketing_visible(prospect.country_code,prospect.state_code,prospect.municipality_code,prospect.locality_code,prospect.neighborhood) OR (prospect.status='do_not_contact' AND new_status<>'do_not_contact') THEN RAISE EXCEPTION 'Operación no autorizada' USING ERRCODE='42501'; END IF;
 UPDATE public.crm_prospects SET status=new_status,notes=new_notes,updated_at=now() WHERE id=target;
 FOR address IN SELECT DISTINCT lower(btrim(a)) FROM unnest(ARRAY[prospect.email,prospect.public_email]) t(a) WHERE nullif(btrim(a),'') IS NOT NULL LOOP
  IF new_status IN ('contacted','interested','trial','converted') THEN PERFORM public.crm_record_contacted_email(address); END IF;
  IF new_status='do_not_contact' THEN
   INSERT INTO public.crm_email_exclusions(email) VALUES(address) ON CONFLICT DO NOTHING;
   UPDATE public.crm_prospects p SET status='do_not_contact',updated_at=now() WHERE p.status<>'do_not_contact' AND address IN(lower(btrim(p.email)),lower(btrim(p.public_email)));
  END IF;
 END LOOP;
 END $$;
REVOKE ALL ON FUNCTION public.crm_marketing_save_contact(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_marketing_save_contact(uuid,text,text) TO authenticated;
