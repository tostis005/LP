-- Separación de cuentas: gestionar un comercio no habilita alta como cliente.
CREATE OR REPLACE FUNCTION public.join_program(p_business uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Identifícate con una cuenta de cliente para unirte'; END IF;
 IF public.is_platform_admin() OR EXISTS(
  SELECT 1 FROM public.business_members bm WHERE bm.user_id=auth.uid() AND bm.active
 ) THEN
  RAISE EXCEPTION 'Para guardar tarjetas necesitas una cuenta de cliente independiente';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.businesses b WHERE b.id=p_business AND b.active AND b.public_listing)
 THEN RAISE EXCEPTION 'Este programa aún no está publicado'; END IF;
 INSERT INTO public.loyalty_memberships(business_id,customer_id)
 VALUES(p_business,auth.uid()) ON CONFLICT(business_id,customer_id) DO NOTHING;
 SELECT id INTO v_id FROM public.loyalty_memberships
 WHERE business_id=p_business AND customer_id=auth.uid();
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.join_program(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.join_program(uuid) TO authenticated;

-- Las fichas no publicadas tienen vista previa privada en /negocio/vista-previa.
-- No aparecen mediante la consulta pública ni en el mapa.
CREATE OR REPLACE FUNCTION public.public_business_details(p_slug text)
RETURNS TABLE(
 business_id uuid,business_name text,description text,accent_color text,category text,
 logo_url text,card_text text,card_text_color text,stamp_color text,stamp_icon text,
 reward_label text,program_type text,reward_cost integer,cashback_bps integer,
 points_per_euro numeric,public_listing boolean,locations_json jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT b.id,b.name,b.description,b.accent_color,b.category,
  b.logo_url,b.card_text,b.card_text_color,b.stamp_color,b.stamp_icon,
  p.reward_label,p.type,p.reward_cost,p.cashback_bps,p.points_per_euro,b.public_listing,
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'id',l.id,'business_id',l.business_id,'name',l.name,'address',l.address,
   'city',l.city,'country',l.country,'lat',l.lat,'lng',l.lng
  ) ORDER BY l.name)
  FROM public.business_locations l WHERE l.business_id=b.id AND l.visible),'[]'::jsonb)
 FROM public.businesses b JOIN public.loyalty_programs p ON p.business_id=b.id
 WHERE b.slug=p_slug AND b.active AND b.public_listing
 LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.public_business_details(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_business_details(text) TO anon,authenticated;

-- El correo completo solo permanece en auth.users y en servicios de envío.
CREATE OR REPLACE FUNCTION public.business_staff_directory(p_business uuid)
RETURNS TABLE(user_id uuid,full_name text,email text,role text,active boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT (public.is_business_manager(p_business) OR public.is_platform_admin()) THEN
  RAISE EXCEPTION 'No autorizado';
 END IF;
 RETURN QUERY SELECT m.user_id,p.full_name,
  (left(split_part(u.email,'@',1),2)||'***@'||left(split_part(u.email,'@',2),1)||'***')::text,
  m.role,m.active FROM public.business_members m
 JOIN auth.users u ON u.id=m.user_id JOIN public.profiles p ON p.id=m.user_id
 WHERE m.business_id=p_business ORDER BY m.created_at;
END $$;
REVOKE ALL ON FUNCTION public.business_staff_directory(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_staff_directory(uuid) TO authenticated;

-- El propietario no necesita leer tokens de baja, IDs de destinatarios o cola de entregas.
DROP POLICY IF EXISTS marketing_deliveries_manager_read ON public.marketing_deliveries;
CREATE POLICY marketing_deliveries_admin_only_read ON public.marketing_deliveries
 FOR SELECT TO authenticated USING (public.is_platform_admin());
