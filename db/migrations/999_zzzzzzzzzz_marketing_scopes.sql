CREATE TABLE public.crm_marketing_users(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 active boolean NOT NULL DEFAULT true,
 scopes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(scopes)='array')
);
ALTER TABLE public.crm_marketing_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_marketing_users FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.crm_is_marketing() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.crm_marketing_users WHERE user_id=auth.uid())
$$;
CREATE FUNCTION public.crm_marketing_active() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.crm_marketing_users WHERE user_id=auth.uid() AND active)
$$;
CREATE FUNCTION public.crm_marketing_visible(c text,s text,m text,l text,n text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.crm_marketing_users u CROSS JOIN LATERAL jsonb_array_elements(u.scopes) x
 WHERE u.user_id=auth.uid() AND u.active
 AND (x->>'country_code'='' OR x->>'country_code'=c)
 AND (x->>'state_code'='' OR x->>'state_code'=s)
 AND (x->>'municipality_code'='' OR x->>'municipality_code'=m)
 AND (x->>'locality_code'='' OR x->>'locality_code'=l)
 AND (x->>'neighborhood'='' OR x->>'neighborhood'=n))
$$;
CREATE POLICY crm_marketing_read ON public.crm_prospects FOR SELECT TO authenticated USING(public.crm_marketing_visible(country_code,state_code,municipality_code,locality_code,neighborhood));
CREATE POLICY crm_marketing_history_read ON public.crm_mail_history FOR SELECT TO authenticated USING(public.crm_marketing_active() AND EXISTS(SELECT 1 FROM public.crm_prospects p WHERE lower(crm_mail_history.correspondent) IN(lower(p.email),lower(p.public_email))));
CREATE FUNCTION public.crm_admin_marketing_users() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'name',u.raw_user_meta_data->>'full_name','role',CASE WHEN a.user_id IS NOT NULL THEN 'admin' WHEN m.user_id IS NOT NULL THEN 'marketing' WHEN EXISTS(SELECT 1 FROM public.business_members b WHERE b.user_id=u.id AND b.active AND b.role='owner') THEN 'owner' WHEN EXISTS(SELECT 1 FROM public.business_members b WHERE b.user_id=u.id AND b.active AND b.role='manager') THEN 'manager' WHEN EXISTS(SELECT 1 FROM public.business_members b WHERE b.user_id=u.id AND b.active) THEN 'employee' ELSE 'customer' END,'active',m.active,'scopes',m.scopes) ORDER BY u.email),'[]'::jsonb) FROM auth.users u LEFT JOIN public.platform_admins a ON a.user_id=u.id LEFT JOIN public.crm_marketing_users m ON m.user_id=u.id);
END $$;
CREATE FUNCTION public.crm_admin_save_marketing(e text,n text,h text,enabled boolean,permissions jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid;
BEGIN
 IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
 SELECT id INTO uid FROM auth.users WHERE lower(email)=lower(e);
 IF uid IS NULL THEN
  INSERT INTO auth.users(email,password_hash,raw_user_meta_data) VALUES(lower(e),h,jsonb_build_object('full_name',n,'crm_marketing_invited',true)) RETURNING id INTO uid;
 ELSIF NOT EXISTS(SELECT 1 FROM public.crm_marketing_users WHERE user_id=uid) THEN
  RAISE EXCEPTION 'Ese correo ya pertenece a otro tipo de cuenta';
 END IF;
 INSERT INTO public.crm_marketing_users(user_id,active,scopes) VALUES(uid,enabled,permissions) ON CONFLICT(user_id) DO UPDATE SET active=excluded.active,scopes=excluded.scopes;
 RETURN uid;
END $$;
REVOKE ALL ON FUNCTION public.crm_is_marketing(),public.crm_marketing_active(),public.crm_marketing_visible(text,text,text,text,text),public.crm_admin_marketing_users(),public.crm_admin_save_marketing(text,text,text,boolean,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_is_marketing(),public.crm_marketing_active(),public.crm_marketing_visible(text,text,text,text,text),public.crm_admin_marketing_users(),public.crm_admin_save_marketing(text,text,text,boolean,jsonb) TO authenticated;
