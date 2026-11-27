-- Only platform administrators may provision/reset existing managed staff.
CREATE FUNCTION public.admin_reset_staff_password(target uuid, new_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
 IF target IS NULL OR target=auth.uid() OR EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id=target) OR NOT (
   EXISTS(SELECT 1 FROM public.crm_marketing_users WHERE user_id=target) OR
   EXISTS(SELECT 1 FROM public.business_members WHERE user_id=target AND active AND role IN ('owner','manager','employee'))
 ) THEN RAISE EXCEPTION 'Solo se pueden cambiar contraseñas de cuentas de marketing y personal de negocios' USING ERRCODE='42501'; END IF;
 IF new_hash IS NULL OR new_hash !~ '^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$' THEN RAISE EXCEPTION 'Contraseña no válida'; END IF;
 UPDATE auth.users SET password_hash=new_hash,updated_at=now(),
  email_confirmed_at=COALESCE(email_confirmed_at,now()),
  raw_user_meta_data=CASE WHEN EXISTS(SELECT 1 FROM public.crm_marketing_users WHERE user_id=target)
    THEN COALESCE(raw_user_meta_data,'{}'::jsonb)||jsonb_build_object('crm_marketing_invited',false,'crm_marketing_provisioned',true)
    ELSE raw_user_meta_data END
 WHERE id=target;
 IF NOT FOUND THEN RAISE EXCEPTION 'Usuario no encontrado'; END IF;
 DELETE FROM auth.sessions WHERE user_id=target;
 DELETE FROM auth.email_tokens WHERE user_id=target AND purpose IN ('reset','verify');
END $$;
REVOKE ALL ON FUNCTION public.admin_reset_staff_password(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_staff_password(uuid,text) TO authenticated;
