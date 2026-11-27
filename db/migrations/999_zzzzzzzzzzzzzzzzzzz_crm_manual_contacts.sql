ALTER TABLE public.crm_prospects ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'Kreyvi';
ALTER TABLE public.crm_prospects ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.crm_prospects ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE public.crm_prospects ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS crm_prospects_closed_idx ON public.crm_prospects(closed_at) WHERE closed_at IS NOT NULL;

CREATE FUNCTION public.crm_marketing_can_choose_region(c text,s text,m text,l text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.crm_marketing_users u CROSS JOIN LATERAL jsonb_array_elements(u.scopes) x
 WHERE u.user_id=auth.uid() AND u.active
 AND (x->>'country_code'='' OR x->>'country_code'=c)
 AND (x->>'state_code'='' OR x->>'state_code'=s)
 AND (x->>'municipality_code'='' OR x->>'municipality_code'=m)
 AND (x->>'locality_code'='' OR x->>'locality_code'=l))
$$;
CREATE FUNCTION public.crm_create_manual_prospect(v jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE parts text[]; n text; cat text; colony text; mail text; tel text; addr text; site text; insta text; note text; label text; geo record; result uuid; admin boolean;
BEGIN
 admin:=public.is_platform_admin();
 IF auth.uid() IS NULL OR NOT (admin OR public.crm_marketing_active()) THEN RAISE EXCEPTION 'Sin acceso al CRM' USING ERRCODE='42501'; END IF;
 parts:=string_to_array(coalesce(v->>'region',''),':');
 n:=btrim(coalesce(v->>'name',''));cat:=btrim(coalesce(v->>'category',''));colony:=btrim(coalesce(v->>'neighborhood',''));
 mail:=lower(btrim(coalesce(v->>'email','')));tel:=btrim(coalesce(v->>'phone',''));addr:=btrim(coalesce(v->>'address',''));
 site:=btrim(coalesce(v->>'website',''));insta:=btrim(coalesce(v->>'instagram',''));note:=btrim(coalesce(v->>'notes',''));
 IF coalesce(array_length(parts,1),0)<>4 OR length(n) NOT BETWEEN 2 AND 240 OR length(cat) NOT BETWEEN 1 AND 80 OR length(colony)>200 OR length(mail)>254 OR length(tel)>80 OR length(addr)>500 OR length(site)>500 OR length(insta)>500 OR length(note)>2000 OR (mail<>'' AND mail !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') THEN RAISE EXCEPTION 'Revisa los datos del negocio.'; END IF;
 IF NOT admin AND NOT public.crm_marketing_visible(parts[1],parts[2],parts[3],parts[4],colony) THEN RAISE EXCEPTION 'Selecciona una localidad y colonia dentro de tus zonas asignadas.' USING ERRCODE='42501'; END IF;
 SELECT state,municipality,city INTO geo FROM public.crm_prospects WHERE country_code=parts[1] AND state_code=parts[2] AND municipality_code=parts[3] AND locality_code=parts[4] LIMIT 1;
 IF NOT FOUND THEN
  IF parts=ARRAY['MX','11','020','0001'] THEN SELECT 'Guanajuato'::text AS state,'León'::text AS municipality,'León de los Aldama'::text AS city INTO geo;
  ELSE RAISE EXCEPTION 'Localidad no reconocida.'; END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext('kreyvi-crm-manual-create'));
 IF EXISTS(SELECT 1 FROM public.crm_prospects p WHERE p.country_code=parts[1] AND p.state_code=parts[2] AND p.municipality_code=parts[3] AND p.locality_code=parts[4] AND lower(btrim(p.name))=lower(n) AND (addr='' OR coalesce(p.address,'')='' OR lower(btrim(p.address))=lower(addr)) AND (admin OR public.crm_marketing_visible(p.country_code,p.state_code,p.municipality_code,p.locality_code,p.neighborhood))) THEN RAISE EXCEPTION 'Ya existe un negocio con ese nombre y ubicación. Busca su ficha antes de duplicarlo.'; END IF;
 IF admin THEN label:='Kreyvi'; ELSE SELECT coalesce(nullif(btrim(raw_user_meta_data->>'full_name'),''),'Usuario de marketing') INTO label FROM auth.users WHERE id=auth.uid(); END IF;
 INSERT INTO public.crm_prospects(source,source_id,name,country_code,state_code,state,municipality_code,municipality,locality_code,city,activity_code,activity,category,email,phone,address,website,instagram,neighborhood,notes,origin,created_by,status)
 VALUES('WEB','manual-'||gen_random_uuid()::text,n,parts[1],parts[2],geo.state,parts[3],geo.municipality,parts[4],geo.city,'',cat,cat,nullif(mail,''),tel,addr,site,insta,colony,note,label,auth.uid(),CASE WHEN EXISTS(SELECT 1 FROM public.crm_email_exclusions e WHERE e.email=mail) THEN 'do_not_contact' ELSE 'pending_review' END) RETURNING id INTO result;
 RETURN result;
END $$;
CREATE FUNCTION public.crm_close_prospect(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE p public.crm_prospects%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT(public.is_platform_admin() OR public.crm_marketing_active()) THEN RAISE EXCEPTION 'Sin acceso al CRM' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('crm-sendcorex-send'));
 SELECT * INTO p FROM public.crm_prospects WHERE id=target FOR UPDATE;
 IF NOT FOUND OR NOT(public.is_platform_admin() OR public.crm_marketing_visible(p.country_code,p.state_code,p.municipality_code,p.locality_code,p.neighborhood)) THEN RAISE EXCEPTION 'Sin acceso a este negocio' USING ERRCODE='42501'; END IF;
 UPDATE public.crm_prospects SET closed_at=now(),closed_by=auth.uid(),updated_at=now() WHERE id=target AND closed_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.crm_marketing_can_choose_region(text,text,text,text),public.crm_create_manual_prospect(jsonb),public.crm_close_prospect(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_marketing_can_choose_region(text,text,text,text),public.crm_create_manual_prospect(jsonb),public.crm_close_prospect(uuid) TO authenticated;
