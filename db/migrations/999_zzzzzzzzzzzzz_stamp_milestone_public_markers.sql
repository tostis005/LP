-- Public card previews expose only the configured reward position and label.
-- Match the existing public_business_details slug visibility; no customer data.
CREATE OR REPLACE FUNCTION public.public_stamp_milestones(p_slug text)
RETURNS TABLE("position" integer,label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT r.position,o.label
 FROM public.businesses b
 JOIN public.loyalty_programs p ON p.business_id=b.id AND p.type='stamps'
 JOIN public.stamp_milestone_rules r ON r.business_id=b.id AND r.active
 JOIN public.milestone_reward_options o ON o.id=r.reward_option_id AND o.business_id=b.id AND o.active
 WHERE b.slug=p_slug AND b.active AND r.position>0 AND r.position<p.reward_cost
 ORDER BY r.position
$$;
REVOKE ALL ON FUNCTION public.public_stamp_milestones(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_stamp_milestones(text) TO anon,authenticated;
-- The existing partial unique index stamp_milestone_active_position continues
-- to prevent duplicate active rules, including concurrent saves.
CREATE OR REPLACE FUNCTION public.manager_add_stamp_milestone(p_business uuid,p_position integer,p_reward uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.loyalty_programs%rowtype; v_id uuid;
BEGIN
 IF NOT (public.is_business_manager(p_business) OR public.is_platform_admin()) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 SELECT * INTO p FROM public.loyalty_programs WHERE business_id=p_business FOR UPDATE;
 IF NOT FOUND OR p.type<>'stamps' OR p.reward_cost NOT BETWEEN 2 AND 30 OR p_position IS NULL OR p_position<1 OR p_position>=p.reward_cost
 THEN RAISE EXCEPTION 'Elige una posición anterior al premio final, en una tarjeta de 2 a 30 sellos'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.milestone_reward_options WHERE id=p_reward AND business_id=p_business AND active)
 THEN RAISE EXCEPTION 'El regalo debe estar activo en el catálogo de premios intermedios del establecimiento'; END IF;
 IF EXISTS(SELECT 1 FROM public.stamp_milestone_rules WHERE business_id=p_business AND position=p_position AND active)
 THEN RAISE EXCEPTION 'Ese sello ya tiene un premio intermedio asignado. Elige otro sello.'; END IF;
 INSERT INTO public.stamp_milestone_rules(business_id,position,cycle_size,reward_option_id) VALUES(p_business,p_position,p.reward_cost,p_reward) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
