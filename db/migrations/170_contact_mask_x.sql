-- Datos de contacto protegidos en la propia respuesta del servidor.
-- Los gestores no reciben la dirección completa de sus clientes, tampoco por API.
CREATE OR REPLACE FUNCTION public.business_customer_directory(p_business uuid)
RETURNS TABLE(user_id uuid,full_name text,email text,balance integer,total_earned integer,visits bigint,marketing_ok boolean,joined_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT (public.is_business_manager(p_business) OR public.is_platform_admin()) THEN
  RAISE EXCEPTION 'No autorizado';
 END IF;
 RETURN QUERY
 SELECT m.customer_id,p.full_name,
   (left(split_part(u.email,'@',1),2)||repeat('X',greatest(3,length(split_part(u.email,'@',1))-2))
    ||'@'||left(split_part(u.email,'@',2),1)||repeat('X',greatest(3,length(split_part(u.email,'@',2))-1)))::text,
   m.balance,m.total_earned,
   (SELECT count(*) FROM public.loyalty_transactions t WHERE t.membership_id=m.id AND t.kind='earn'),
   coalesce(c.opted_in,false),m.created_at
 FROM public.loyalty_memberships m JOIN public.profiles p ON p.id=m.customer_id
 JOIN auth.users u ON u.id=m.customer_id
 LEFT JOIN public.marketing_consents c ON c.customer_id=m.customer_id AND c.business_id=p_business
 WHERE m.business_id=p_business ORDER BY m.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.business_staff_directory(p_business uuid)
RETURNS TABLE(user_id uuid,full_name text,email text,role text,active boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT (public.is_business_manager(p_business) OR public.is_platform_admin()) THEN
  RAISE EXCEPTION 'No autorizado';
 END IF;
 RETURN QUERY SELECT m.user_id,p.full_name,
   (left(split_part(u.email,'@',1),2)||repeat('X',greatest(3,length(split_part(u.email,'@',1))-2))
    ||'@'||left(split_part(u.email,'@',2),1)||repeat('X',greatest(3,length(split_part(u.email,'@',2))-1)))::text,
   m.role,m.active FROM public.business_members m
 JOIN auth.users u ON u.id=m.user_id JOIN public.profiles p ON p.id=m.user_id
 WHERE m.business_id=p_business ORDER BY m.created_at;
END $$;
