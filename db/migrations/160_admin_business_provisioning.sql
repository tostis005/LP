-- Alta y vinculación de franquicias controlada exclusivamente por el superadministrador.
-- Cada local es un NEGOCIO con facturación propia; el propietario puede gestionar varios.
-- Seleccionar un programa existente CLONA su diseño y reglas, pero no comparte saldos.
ALTER TABLE public.business_billing
 ADD COLUMN IF NOT EXISTS agreed_monthly_cents integer
 CHECK(agreed_monthly_cents IS NULL OR agreed_monthly_cents BETWEEN 0 AND 100000000);

-- Ni siquiera las funciones antiguas permiten que un negocio cree sucursales.
REVOKE ALL ON FUNCTION public.manager_create_branch(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.manager_create_branch(
 p_source_business uuid,p_name text,p_slug text,p_owner_email text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 RAISE EXCEPTION 'El alta de sucursales corresponde a Loyally. Solicita el nuevo establecimiento al equipo de administración.';
END $$;

-- Solo el administrador registra la primera localización. Los negocios editan la suya.
DROP POLICY IF EXISTS locations_insert ON public.business_locations;
DROP POLICY IF EXISTS locations_delete ON public.business_locations;
DROP POLICY IF EXISTS locations_update ON public.business_locations;
CREATE POLICY locations_insert ON public.business_locations FOR INSERT TO authenticated
 WITH CHECK(public.is_platform_admin());
CREATE POLICY locations_delete ON public.business_locations FOR DELETE TO authenticated
 USING(public.is_platform_admin());
CREATE POLICY locations_update ON public.business_locations FOR UPDATE TO authenticated
 USING(public.is_business_manager(business_id) OR public.is_platform_admin())
 WITH CHECK(public.is_business_manager(business_id) OR public.is_platform_admin());

-- Blindar campos bajo control comercial de Loyally incluso ante UPDATE directo.
CREATE OR REPLACE FUNCTION public.limit_business_registration_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_platform_admin() THEN
  IF NEW.parent_business_id IS DISTINCT FROM OLD.parent_business_id
     OR NEW.active IS DISTINCT FROM OLD.active THEN
   RAISE EXCEPTION 'La estructura y activación de negocios son gestionadas por Loyally';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_business_structure ON public.businesses;
CREATE TRIGGER guard_business_structure BEFORE UPDATE ON public.businesses
 FOR EACH ROW EXECUTE FUNCTION public.limit_business_registration_changes();

CREATE OR REPLACE FUNCTION public.limit_business_location_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_platform_admin() AND NOT (SELECT rolsuper FROM pg_roles WHERE rolname=session_user) THEN
  IF TG_OP='INSERT' OR TG_OP='DELETE' THEN
   RAISE EXCEPTION 'Solo Loyally puede dar de alta o retirar locales';
  END IF;
  IF NEW.business_id IS DISTINCT FROM OLD.business_id THEN
   RAISE EXCEPTION 'No puedes trasladar una ubicación a otro negocio';
  END IF;
 END IF;
 IF TG_OP='INSERT' AND EXISTS(SELECT 1 FROM public.business_locations l WHERE l.business_id=NEW.business_id) THEN
  RAISE EXCEPTION 'Cada negocio tiene una ubicación. Para otro local, Loyally creará un negocio adicional.';
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS guard_business_locations ON public.business_locations;
CREATE TRIGGER guard_business_locations BEFORE INSERT OR UPDATE OR DELETE ON public.business_locations
 FOR EACH ROW EXECUTE FUNCTION public.limit_business_location_changes();

-- Alta comercial con empresa matriz opcional, tarjeta base y precio acordado por local.
CREATE OR REPLACE FUNCTION public.admin_provision_business(
 p_name text,p_slug text,p_owner_email text,p_parent_business uuid DEFAULT NULL,
 p_existing_program uuid DEFAULT NULL,p_monthly_price_cents integer DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 v_id uuid; v_parent uuid; v_source uuid;
BEGIN
 IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Solo el superadministrador puede crear negocios'; END IF;
 IF p_monthly_price_cents IS NOT NULL AND (p_monthly_price_cents<0 OR p_monthly_price_cents>100000000)
 THEN RAISE EXCEPTION 'Importe mensual no válido'; END IF;
 IF p_parent_business IS NOT NULL THEN
  SELECT coalesce(parent_business_id,id) INTO v_parent FROM public.businesses
   WHERE id=p_parent_business AND active;
  IF v_parent IS NULL THEN RAISE EXCEPTION 'La empresa matriz no existe o está inactiva'; END IF;
 END IF;
 IF p_existing_program IS NOT NULL THEN
  SELECT business_id INTO v_source FROM public.loyalty_programs
   WHERE business_id=p_existing_program;
  IF v_source IS NULL THEN RAISE EXCEPTION 'No se ha encontrado la tarjeta seleccionada'; END IF;
 END IF;
 v_id:=public.admin_create_business(p_name,p_slug,p_owner_email);
 UPDATE public.businesses SET parent_business_id=v_parent WHERE id=v_id;
 IF v_source IS NOT NULL THEN
  UPDATE public.businesses target
   SET description=src.description,category=src.category,logo_url=src.logo_url,
   accent_color=src.accent_color,card_background=src.card_background,
   card_text=src.card_text,card_text_color=src.card_text_color,
   stamp_color=src.stamp_color,stamp_icon=src.stamp_icon,stamp_image_url=src.stamp_image_url
   FROM public.businesses src WHERE target.id=v_id AND src.id=v_source;
  UPDATE public.loyalty_programs target SET
   type=src.type,reward_label=src.reward_label,reward_cost=src.reward_cost,
   cashback_bps=src.cashback_bps,points_per_euro=src.points_per_euro,
   max_stamps_per_action=src.max_stamps_per_action,max_ticket_cents=src.max_ticket_cents,
   min_seconds_between_awards=src.min_seconds_between_awards,
   max_daily_awards_per_employee=src.max_daily_awards_per_employee,
   require_ticket_reference=src.require_ticket_reference
   FROM public.loyalty_programs src WHERE target.business_id=v_id AND src.business_id=v_source;
 END IF;
 UPDATE public.business_billing SET agreed_monthly_cents=p_monthly_price_cents WHERE business_id=v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_provision_business(text,text,text,uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_provision_business(text,text,text,uuid,uuid,integer) TO authenticated;

-- El administrador puede crear la dirección inicial de un negocio. Los gerentes
-- pueden editarla posteriormente, pero nunca registrar un segundo establecimiento.
CREATE OR REPLACE FUNCTION public.admin_set_business_location(
 p_business uuid,p_name text,p_address text,p_city text,p_country text,p_lat double precision,p_lng double precision
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Solo Loyally puede registrar locales'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=p_business) THEN
  RAISE EXCEPTION 'Negocio no encontrado'; END IF;
 IF length(btrim(coalesce(p_name,'')))<2 OR length(btrim(coalesce(p_address,'')))<4
  OR length(btrim(coalesce(p_city,'')))<2 OR length(btrim(coalesce(p_country,'')))<2
  OR p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN
  RAISE EXCEPTION 'Completa la dirección y coordenadas del establecimiento'; END IF;
 SELECT id INTO v_id FROM public.business_locations WHERE business_id=p_business LIMIT 1 FOR UPDATE;
 IF v_id IS NULL THEN
  INSERT INTO public.business_locations(business_id,name,address,city,country,lat,lng)
  VALUES(p_business,btrim(p_name),btrim(p_address),btrim(p_city),btrim(p_country),p_lat,p_lng)
  RETURNING id INTO v_id;
 ELSE
  UPDATE public.business_locations SET name=btrim(p_name),address=btrim(p_address),
   city=btrim(p_city),country=btrim(p_country),lat=p_lat,lng=p_lng WHERE id=v_id;
 END IF;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_business_location(uuid,text,text,text,text,double precision,double precision) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_business_location(uuid,text,text,text,text,double precision,double precision) TO authenticated;

-- Los descuentos por volumen se pactan establecimiento por establecimiento.
CREATE OR REPLACE FUNCTION public.admin_set_business_contract(p_business uuid,p_monthly_price_cents integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Solo Loyally puede pactar contratos'; END IF;
 IF p_monthly_price_cents IS NOT NULL AND (p_monthly_price_cents<0 OR p_monthly_price_cents>100000000)
 THEN RAISE EXCEPTION 'Precio no válido'; END IF;
 UPDATE public.business_billing SET agreed_monthly_cents=p_monthly_price_cents,updated_at=now()
 WHERE business_id=p_business;
 IF NOT FOUND THEN RAISE EXCEPTION 'Negocio no encontrado'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_business_contract(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_business_contract(uuid,integer) TO authenticated;
