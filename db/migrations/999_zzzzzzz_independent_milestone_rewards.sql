-- Catálogo independiente para premios intermedios. No cambia el catálogo final.
CREATE TABLE public.milestone_reward_options(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 label text NOT NULL CHECK(char_length(btrim(label)) BETWEEN 2 AND 120),
 retail_cents integer CHECK(retail_cents BETWEEN 0 AND 100000000),
 cost_cents integer CHECK(cost_cents BETWEEN 0 AND 100000000),
 active boolean NOT NULL DEFAULT true,
 position integer NOT NULL DEFAULT 0 CHECK(position BETWEEN 0 AND 9999),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX milestone_reward_options_business_idx ON public.milestone_reward_options(business_id,active,position);
ALTER TABLE public.milestone_reward_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY milestone_reward_options_read ON public.milestone_reward_options FOR SELECT TO authenticated USING(public.is_business_manager(business_id) OR public.is_platform_admin());
CREATE POLICY milestone_reward_options_insert ON public.milestone_reward_options FOR INSERT TO authenticated WITH CHECK(public.is_business_manager(business_id) OR public.is_platform_admin());
CREATE POLICY milestone_reward_options_update ON public.milestone_reward_options FOR UPDATE TO authenticated USING(public.is_business_manager(business_id) OR public.is_platform_admin()) WITH CHECK(public.is_business_manager(business_id) OR public.is_platform_admin());
REVOKE ALL ON public.milestone_reward_options FROM PUBLIC,anon,lp_api;
GRANT SELECT,INSERT ON public.milestone_reward_options TO authenticated;
GRANT UPDATE(label,retail_cents,cost_cents,active,position) ON public.milestone_reward_options TO authenticated;

-- Copiar únicamente regalos utilizados en hitos, con IDs nuevos e independientes.
CREATE TEMP TABLE milestone_reward_mapping(old_id uuid PRIMARY KEY,new_id uuid NOT NULL DEFAULT gen_random_uuid()) ON COMMIT DROP;
INSERT INTO milestone_reward_mapping(old_id)
 SELECT reward_option_id FROM public.stamp_milestone_rules
 UNION SELECT reward_option_id FROM public.stamp_milestone_grants WHERE reward_option_id IS NOT NULL;
INSERT INTO public.milestone_reward_options(id,business_id,label,retail_cents,cost_cents,active,position,created_at)
 SELECT m.new_id,o.business_id,o.label,o.retail_cents,o.cost_cents,o.active,o.position,o.created_at
 FROM milestone_reward_mapping m JOIN public.reward_options o ON o.id=m.old_id;
ALTER TABLE public.stamp_milestone_rules DROP CONSTRAINT stamp_milestone_rules_reward_option_id_fkey;
ALTER TABLE public.stamp_milestone_grants DROP CONSTRAINT stamp_milestone_grants_reward_option_id_fkey;
UPDATE public.stamp_milestone_rules r SET reward_option_id=m.new_id FROM milestone_reward_mapping m WHERE r.reward_option_id=m.old_id;
UPDATE public.stamp_milestone_grants g SET reward_option_id=m.new_id FROM milestone_reward_mapping m WHERE g.reward_option_id=m.old_id;
ALTER TABLE public.stamp_milestone_rules ADD CONSTRAINT stamp_milestone_rules_reward_option_id_fkey FOREIGN KEY(reward_option_id) REFERENCES public.milestone_reward_options(id) ON DELETE RESTRICT;
ALTER TABLE public.stamp_milestone_grants ADD CONSTRAINT stamp_milestone_grants_reward_option_id_fkey FOREIGN KEY(reward_option_id) REFERENCES public.milestone_reward_options(id) ON DELETE SET NULL;
ALTER TABLE public.reward_redemptions ADD COLUMN milestone_reward_option_id uuid REFERENCES public.milestone_reward_options(id) ON DELETE SET NULL;
-- Los canjes históricos mantienen su etiqueta y coste originales.
CREATE OR REPLACE FUNCTION public.manager_stamp_milestones(p_business uuid)
RETURNS TABLE(id uuid,"position" integer,cycle_size integer,label text,active boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT (public.is_business_manager(p_business) OR public.is_platform_admin()) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 RETURN QUERY SELECT r.id,r.position,r.cycle_size,o.label,r.active
 FROM public.stamp_milestone_rules r JOIN public.milestone_reward_options o ON o.id=r.reward_option_id
 WHERE r.business_id=p_business ORDER BY r.active DESC,r.position,r.created_at DESC;
END $$;

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
 INSERT INTO public.stamp_milestone_rules(business_id,position,cycle_size,reward_option_id) VALUES(p_business,p_position,p.reward_cost,p_reward) RETURNING id INTO v_id;
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.issue_stamp_milestones()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.total_earned<=OLD.total_earned OR NEW.balance<=OLD.balance THEN RETURN NEW; END IF;
 -- Base consumida: los canjes finales reducen saldo pero no total_earned.
 -- Cruces múltiples en una compra y ciclos adelantados se registran todos.
 INSERT INTO public.stamp_milestone_grants(rule_id,membership_id,threshold_total,position,reward_option_id,label,cost_cents,retail_cents)
 SELECT r.id,NEW.id,(OLD.total_earned-OLD.balance)+r.position+k*r.cycle_size,r.position,o.id,o.label,o.cost_cents,o.retail_cents
 FROM public.stamp_milestone_rules r
 JOIN public.milestone_reward_options o ON o.id=r.reward_option_id AND o.active
 JOIN public.loyalty_programs p ON p.business_id=r.business_id AND p.type='stamps' AND p.reward_cost=r.cycle_size
 CROSS JOIN LATERAL generate_series(GREATEST(0,(OLD.balance-r.position)/r.cycle_size-1),GREATEST(0,(NEW.balance-r.position)/r.cycle_size)) k
 WHERE r.business_id=NEW.business_id AND r.active
 AND r.position+k*r.cycle_size>OLD.balance AND r.position+k*r.cycle_size<=NEW.balance
 ON CONFLICT(membership_id,threshold_total) DO NOTHING;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.stamp_milestone_details(p_membership uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.loyalty_memberships%rowtype;
BEGIN
 SELECT * INTO m FROM public.loyalty_memberships WHERE id=p_membership;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT (m.customer_id=auth.uid() OR public.is_business_staff(m.business_id))
 THEN RAISE EXCEPTION 'No autorizado'; END IF;
 RETURN jsonb_build_object(
 'rules',coalesce((SELECT jsonb_agg(jsonb_build_object('position',r.position,'label',o.label) ORDER BY r.position)
 FROM public.stamp_milestone_rules r JOIN public.milestone_reward_options o ON o.id=r.reward_option_id AND o.active
 WHERE r.business_id=m.business_id AND r.active),'[]'::jsonb),
 'grants',coalesce((SELECT jsonb_agg(jsonb_build_object('id',g.id,'label',g.label,'position',g.position,'issued_at',g.issued_at,
 'available',m.total_earned>=g.threshold_total AND (g.transaction_id IS NULL OR EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=g.transaction_id)),
 'redeemed',g.transaction_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=g.transaction_id)) ORDER BY g.issued_at DESC,g.threshold_total DESC)
 FROM public.stamp_milestone_grants g WHERE g.membership_id=m.id),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.staff_claim_stamp_milestone(p_grant uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE g public.stamp_milestone_grants%rowtype; m public.loyalty_memberships%rowtype; v_tx uuid; v_cost integer;
BEGIN
 SELECT * INTO g FROM public.stamp_milestone_grants WHERE id=p_grant;
 IF NOT FOUND THEN RAISE EXCEPTION 'Premio no disponible'; END IF;
 SELECT * INTO m FROM public.loyalty_memberships WHERE id=g.membership_id FOR UPDATE;
 IF NOT FOUND OR NOT public.is_business_staff(m.business_id) OR NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=m.business_id AND active)
 THEN RAISE EXCEPTION 'No autorizado'; END IF;
 SELECT * INTO g FROM public.stamp_milestone_grants WHERE id=p_grant FOR UPDATE;
 IF m.total_earned<g.threshold_total OR (g.transaction_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions WHERE reversal_of=g.transaction_id))
 THEN RAISE EXCEPTION 'Premio no disponible o ya canjeado'; END IF;
 -- El coste queda fijado al canjear (si no existe el regalo, conserva el coste emitido).
 SELECT cost_cents INTO v_cost FROM public.milestone_reward_options WHERE id=g.reward_option_id AND business_id=m.business_id;
 IF NOT FOUND THEN v_cost:=g.cost_cents; END IF;
 INSERT INTO public.loyalty_transactions(business_id,membership_id,employee_id,kind,amount_delta)
 VALUES(m.business_id,m.id,auth.uid(),'redeem',0) RETURNING id INTO v_tx;
 UPDATE public.reward_redemptions SET reward_option_id=NULL,milestone_reward_option_id=g.reward_option_id,reward_label=g.label,cost_cents=v_cost,retail_cents=g.retail_cents WHERE transaction_id=v_tx;
 UPDATE public.stamp_milestone_grants SET transaction_id=v_tx WHERE id=g.id;
 RETURN true;
END $$;
