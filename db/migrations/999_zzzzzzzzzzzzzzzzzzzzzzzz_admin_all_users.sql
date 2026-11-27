-- All-user editor. Authorization is checked inside the database for every call.
CREATE FUNCTION public.admin_account_details() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object(
 'id',u.id,'name',coalesce(p.full_name,u.raw_user_meta_data->>'full_name'),
 'whatsapp',coalesce(u.raw_user_meta_data->>'whatsapp',''),
 'birth_date',p.birth_date,'gender',p.gender,'confirmed',u.email_confirmed_at IS NOT NULL,
 'qa',EXISTS(SELECT 1 FROM auth.qa_profile_accounts q WHERE q.user_id=u.id),
 'business_links',coalesce(links.items,'[]'::jsonb)
 )), '[]'::jsonb)
 FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id
 LEFT JOIN LATERAL (
  SELECT jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'role',r.role,'active',r.active) ORDER BY b.name,r.role) AS items
  FROM (
   SELECT bm.business_id,bm.role::text AS role,bm.active FROM public.business_members bm WHERE bm.user_id=u.id
   UNION ALL
   SELECT lm.business_id,'customer',true FROM public.loyalty_memberships lm WHERE lm.customer_id=u.id
  ) r JOIN public.businesses b ON b.id=r.business_id
 ) links ON true);
END $$;

CREATE FUNCTION public.admin_edit_account(target uuid,n text,e text,phone text,dob date,g text,new_hash text,marketing_active boolean,marketing_scopes jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE previous auth.users%rowtype; email_changed boolean; verify_needed boolean; qa boolean; marketing boolean;
BEGIN
 IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
 IF n IS NULL OR length(n)>120 OR e IS NULL OR length(e)>254 OR e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  OR phone IS NULL OR (phone<>'' AND phone !~ '^\+[1-9][0-9]{7,14}$')
  OR (dob IS NOT NULL AND (dob<date '1900-01-01' OR dob>current_date))
  OR (g IS NOT NULL AND g NOT IN ('woman','man','other'))
  OR (new_hash IS NOT NULL AND new_hash !~ '^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$')
 THEN RAISE EXCEPTION 'Datos de usuario no válidos'; END IF;
 SELECT * INTO previous FROM auth.users WHERE id=target FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Usuario no encontrado'; END IF;
 email_changed:=lower(previous.email)<>lower(e);
 qa:=EXISTS(SELECT 1 FROM auth.qa_profile_accounts WHERE user_id=target);
 marketing:=EXISTS(SELECT 1 FROM public.crm_marketing_users WHERE user_id=target);
 verify_needed:=email_changed AND NOT qa;
 IF marketing_scopes IS NOT NULL THEN
  IF NOT marketing OR marketing_active IS NULL OR jsonb_typeof(marketing_scopes) IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'No se pueden cambiar permisos de marketing de esta cuenta';
  END IF;
  UPDATE public.crm_marketing_users SET active=marketing_active,scopes=marketing_scopes WHERE user_id=target;
 END IF;
 UPDATE auth.users SET email=lower(e),updated_at=now(),
  password_hash=coalesce(new_hash,password_hash),
  email_confirmed_at=CASE WHEN verify_needed THEN NULL WHEN marketing AND new_hash IS NOT NULL THEN coalesce(email_confirmed_at,now()) ELSE email_confirmed_at END,
  raw_user_meta_data=raw_user_meta_data||jsonb_build_object('full_name',n,'whatsapp',phone,'birth_date',dob,'gender',g)
   ||CASE WHEN marketing AND new_hash IS NOT NULL THEN jsonb_build_object('crm_marketing_invited',false,'crm_marketing_provisioned',true) ELSE '{}'::jsonb END
 WHERE id=target;
 UPDATE public.profiles SET full_name=n,birth_date=dob,gender=g WHERE id=target;
 IF coalesce(previous.raw_user_meta_data->>'whatsapp','')<>phone THEN
  UPDATE public.marketing_consents SET whatsapp_opted_in=false,updated_at=now() WHERE customer_id=target;
 END IF;
 IF email_changed OR new_hash IS NOT NULL THEN
  DELETE FROM auth.sessions WHERE user_id=target;
  DELETE FROM auth.email_tokens WHERE user_id=target;
  IF EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=target) THEN DELETE FROM auth.qa_access_links; END IF;
 END IF;
 RETURN jsonb_build_object('verify',verify_needed,'relogin',target=auth.uid() AND (email_changed OR new_hash IS NOT NULL),'passwordChanged',new_hash IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.admin_account_details(),public.admin_edit_account(uuid,text,text,text,date,text,text,boolean,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_account_details(),public.admin_edit_account(uuid,text,text,text,date,text,text,boolean,jsonb) TO authenticated;
