-- Provisioning a named staff account is an explicit platform-admin action.
-- Keep invitation-only creation available, and never overwrite an existing password.
CREATE FUNCTION public.crm_admin_provision_marketing(e text,n text,h text,enabled boolean,permissions jsonb,initial_password boolean,editing_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid; saved jsonb;
BEGIN
 IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
 IF jsonb_typeof(permissions) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Ámbitos no válidos'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('crm-marketing:'||lower(e)));
 SELECT id INTO uid FROM auth.users WHERE lower(email)=lower(e);
 IF editing_user IS NULL AND uid IS NOT NULL THEN RAISE EXCEPTION 'Ese correo ya tiene una cuenta. Edita el usuario existente.'; END IF;
 IF editing_user IS NOT NULL AND (uid IS DISTINCT FROM editing_user OR NOT EXISTS(SELECT 1 FROM public.crm_marketing_users WHERE user_id=uid)) THEN RAISE EXCEPTION 'Usuario de marketing no encontrado'; END IF;
 IF initial_password AND editing_user IS NOT NULL THEN RAISE EXCEPTION 'La contraseña inicial solo se establece al crear la cuenta'; END IF;
 IF initial_password AND (h IS NULL OR length(h)<40) THEN RAISE EXCEPTION 'Contraseña inicial no válida'; END IF;
 uid:=public.crm_admin_save_marketing(e,n,h,enabled,permissions);
 IF initial_password THEN
  -- Administratively provisioned account: login can start immediately.
  -- Email ownership can still be checked through the normal reset link.
  UPDATE auth.users SET email_confirmed_at=now(),raw_user_meta_data=raw_user_meta_data||jsonb_build_object('crm_marketing_invited',false,'crm_marketing_provisioned',true),updated_at=now() WHERE id=uid;
 END IF;
 SELECT jsonb_build_object('id',user_id,'active',active,'scopes',scopes) INTO saved FROM public.crm_marketing_users WHERE user_id=uid;
 RETURN saved;
END $$;
REVOKE ALL ON FUNCTION public.crm_admin_provision_marketing(text,text,text,boolean,jsonb,boolean,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_admin_provision_marketing(text,text,text,boolean,jsonb,boolean,uuid) TO authenticated;
