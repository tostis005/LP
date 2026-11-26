-- Premios intermedios recurrentes: cada cruce de umbral genera un derecho,
-- independiente del saldo y del premio final. Los derechos ya ganados se conservan.
CREATE TABLE IF NOT EXISTS public.stamp_milestone_rules(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 reward_option_id uuid NOT NULL REFERENCES public.reward_options(id) ON DELETE RESTRICT,
 position integer NOT NULL CHECK(position BETWEEN 1 AND 29), cycle_size integer NOT NULL CHECK(cycle_size BETWEEN 2 AND 30),
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(position<cycle_size)
);
CREATE UNIQUE INDEX IF NOT EXISTS stamp_milestone_active_position ON public.stamp_milestone_rules(business_id,position) WHERE active;
CREATE TABLE IF NOT EXISTS public.stamp_milestone_grants(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rule_id uuid NOT NULL REFERENCES public.stamp_milestone_rules(id) ON DELETE CASCADE,
 membership_id uuid NOT NULL REFERENCES public.loyalty_memberships(id) ON DELETE CASCADE,
 threshold_total integer NOT NULL CHECK(threshold_total>0), position integer NOT NULL,
 reward_option_id uuid REFERENCES public.reward_options(id) ON DELETE SET NULL,
 label text NOT NULL, cost_cents integer, retail_cents integer,
 issued_at timestamptz NOT NULL DEFAULT now(),
 transaction_id uuid REFERENCES public.loyalty_transactions(id) ON DELETE SET NULL,
 UNIQUE(membership_id,threshold_total)
);
ALTER TABLE public.stamp_milestone_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stamp_milestone_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stamp_milestone_rules,public.stamp_milestone_grants FROM PUBLIC,anon,authenticated,lp_api;
-- Un canje intermedio tiene delta cero: se audita su coste sin descontar sellos.
ALTER TABLE public.loyalty_transactions DROP CONSTRAINT IF EXISTS loyalty_transactions_amount_delta_check;
ALTER TABLE public.loyalty_transactions ADD CONSTRAINT loyalty_transactions_amount_delta_check CHECK(amount_delta<>0 OR kind IN ('redeem','reversal'));

CREATE OR REPLACE FUNCTION public.manager_stamp_milestones(p_business uuid)
RETURNS TABLE(id uuid,position integer,cycle_size integer,label text,active boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT (public.is_business_manager(p_business) OR public.is_platform_admin()) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 RETURN QUERY SELECT r.id,r.position,r.cycle_size,o.label,r.active AND o.active
 FROM public.stamp_milestone_rules r JOIN public.reward_options o ON o.id=r.reward_option_id
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
 IF NOT EXISTS(SELECT 1 FROM public.reward_options WHERE id=p_reward AND business_id=p_business AND active)
 THEN RAISE EXCEPTION 'El regalo debe estar activo en el catálogo del establecimiento'; END IF;
 INSERT INTO public.stamp_milestone_rules(business_id,position,cycle_size,reward_option_id) VALUES(p_business,p_position,p.reward_cost,p_reward) RETURNING id INTO v_id;
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.manager_disable_stamp_milestone(p_rule uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_business uuid;
BEGIN
 SELECT business_id INTO v_business FROM public.stamp_milestone_rules WHERE id=p_rule;
 IF NOT FOUND OR NOT (public.is_business_manager(v_business) OR public.is_platform_admin()) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 UPDATE public.stamp_milestone_rules SET active=false WHERE id=p_rule;
 RETURN true;
END $$;

-- Si se modifica la longitud de la tarjeta, se deben desactivar antes los hitos
-- antiguos. No se cambian derechos ya emitidos ni se reinterpretan sus ciclos.
CREATE OR REPLACE FUNCTION public.guard_stamp_milestone_program()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF (NEW.type IS DISTINCT FROM OLD.type OR NEW.reward_cost IS DISTINCT FROM OLD.reward_cost)
 AND EXISTS(SELECT 1 FROM public.stamp_milestone_rules WHERE business_id=OLD.business_id AND active)
 THEN RAISE EXCEPTION 'Desactiva los premios intermedios antes de cambiar la longitud o modalidad de la tarjeta'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_stamp_milestone_program ON public.loyalty_programs;
CREATE TRIGGER guard_stamp_milestone_program BEFORE UPDATE ON public.loyalty_programs FOR EACH ROW EXECUTE FUNCTION public.guard_stamp_milestone_program();

CREATE OR REPLACE FUNCTION public.issue_stamp_milestones()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.total_earned<=OLD.total_earned OR NEW.balance<=OLD.balance THEN RETURN NEW; END IF;
 -- Base consumida: los canjes finales reducen saldo pero no total_earned.
 -- Cruces múltiples en una compra y ciclos adelantados se registran todos.
 INSERT INTO public.stamp_milestone_grants(rule_id,membership_id,threshold_total,position,reward_option_id,label,cost_cents,retail_cents)
 SELECT r.id,NEW.id,(OLD.total_earned-OLD.balance)+r.position+k*r.cycle_size,r.position,o.id,o.label,o.cost_cents,o.retail_cents
 FROM public.stamp_milestone_rules r
 JOIN public.reward_options o ON o.id=r.reward_option_id AND o.active
 JOIN public.loyalty_programs p ON p.business_id=r.business_id AND p.type='stamps' AND p.reward_cost=r.cycle_size
 CROSS JOIN LATERAL generate_series(GREATEST(0,(OLD.balance-r.position)/r.cycle_size-1),GREATEST(0,(NEW.balance-r.position)/r.cycle_size)) k
 WHERE r.business_id=NEW.business_id AND r.active
 AND r.position+k*r.cycle_size>OLD.balance AND r.position+k*r.cycle_size<=NEW.balance
 ON CONFLICT(membership_id,threshold_total) DO NOTHING;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS issue_stamp_milestones ON public.loyalty_memberships;
CREATE TRIGGER issue_stamp_milestones AFTER UPDATE OF total_earned,balance ON public.loyalty_memberships FOR EACH ROW EXECUTE FUNCTION public.issue_stamp_milestones();

CREATE OR REPLACE FUNCTION public.stamp_milestone_details(p_membership uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.loyalty_memberships%rowtype;
BEGIN
 SELECT * INTO m FROM public.loyalty_memberships WHERE id=p_membership;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT (m.customer_id=auth.uid() OR public.is_business_staff(m.business_id))
 THEN RAISE EXCEPTION 'No autorizado'; END IF;
 RETURN jsonb_build_object(
 'rules',coalesce((SELECT jsonb_agg(jsonb_build_object('position',r.position,'label',o.label) ORDER BY r.position)
 FROM public.stamp_milestone_rules r JOIN public.reward_options o ON o.id=r.reward_option_id AND o.active
 WHERE r.business_id=m.business_id AND r.active),'[]'::jsonb),
 'grants',coalesce((SELECT jsonb_agg(jsonb_build_object('id',g.id,'label',g.label,'position',g.position,'issued_at',g.issued_at,
 'available',m.total_earned>=g.threshold_total AND (g.transaction_id IS NULL OR EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=g.transaction_id)),
 'redeemed',g.transaction_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=g.transaction_id)) ORDER BY g.issued_at DESC,g.threshold_total DESC)
 FROM public.stamp_milestone_grants g WHERE g.membership_id=m.id),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.customer_stamp_milestones()
RETURNS TABLE(membership_id uuid,details jsonb) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT m.id,public.stamp_milestone_details(m.id) FROM public.loyalty_memberships m WHERE m.customer_id=auth.uid()
$$;

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
 SELECT cost_cents INTO v_cost FROM public.reward_options WHERE id=g.reward_option_id AND business_id=m.business_id;
 IF NOT FOUND THEN v_cost:=g.cost_cents; END IF;
 INSERT INTO public.loyalty_transactions(business_id,membership_id,employee_id,kind,amount_delta)
 VALUES(m.business_id,m.id,auth.uid(),'redeem',0) RETURNING id INTO v_tx;
 UPDATE public.reward_redemptions SET reward_option_id=g.reward_option_id,reward_label=g.label,cost_cents=v_cost,retail_cents=g.retail_cents WHERE transaction_id=v_tx;
 UPDATE public.stamp_milestone_grants SET transaction_id=v_tx WHERE id=g.id;
 RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.manager_stamp_milestones(uuid),public.manager_add_stamp_milestone(uuid,integer,uuid),public.manager_disable_stamp_milestone(uuid),public.stamp_milestone_details(uuid),public.customer_stamp_milestones(),public.staff_claim_stamp_milestone(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manager_stamp_milestones(uuid),public.manager_add_stamp_milestone(uuid,integer,uuid),public.manager_disable_stamp_milestone(uuid),public.stamp_milestone_details(uuid),public.customer_stamp_milestones(),public.staff_claim_stamp_milestone(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.guard_stamp_milestone_program(),public.issue_stamp_milestones() FROM PUBLIC,anon,authenticated;
