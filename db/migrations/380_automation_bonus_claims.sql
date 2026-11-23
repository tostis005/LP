-- Premios especiales de flujos: confirmación explícita en caja, una única vez.
-- No consume sellos ni afecta al premio normal de la tarjeta.
CREATE TABLE IF NOT EXISTS public.automation_bonus_claims(
 rule_id uuid NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
 membership_id uuid NOT NULL REFERENCES public.loyalty_memberships(id) ON DELETE CASCADE,
 claimed_by uuid NOT NULL REFERENCES auth.users(id),
 claimed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(rule_id,membership_id)
);
ALTER TABLE public.automation_bonus_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_bonus_claims FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.staff_claim_automation_bonus(p_rule uuid,p_membership uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_rule public.automation_rules%rowtype;v_member public.loyalty_memberships%rowtype;
BEGIN
 SELECT * INTO v_rule FROM public.automation_rules WHERE id=p_rule;
 SELECT * INTO v_member FROM public.loyalty_memberships WHERE id=p_membership FOR UPDATE;
 IF NOT FOUND OR v_rule.id IS NULL OR v_rule.business_id IS DISTINCT FROM v_member.business_id
  OR NOT v_rule.active OR v_rule.trigger_kind<>'stamps' OR v_rule.staff_instruction=''
  OR v_member.total_earned<v_rule.target_stamps
  OR NOT EXISTS(SELECT 1 FROM public.automation_queue q
     WHERE q.rule_id=p_rule AND q.membership_id=p_membership)
  OR now()>v_member.created_at+make_interval(days=>v_rule.window_days)
  OR NOT public.is_business_staff(v_member.business_id)
  OR NOT EXISTS(SELECT 1 FROM public.loyalty_programs p
                WHERE p.business_id=v_member.business_id AND p.type='stamps')
 THEN RAISE EXCEPTION 'Este regalo no está disponible para esta tarjeta'; END IF;
 INSERT INTO public.automation_bonus_claims(rule_id,membership_id,claimed_by)
 VALUES(p_rule,p_membership,auth.uid())
 ON CONFLICT(rule_id,membership_id) DO NOTHING;
 IF NOT FOUND THEN RAISE EXCEPTION 'Este regalo especial ya fue entregado'; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.staff_claim_automation_bonus(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_claim_automation_bonus(uuid,uuid) TO authenticated;

-- Contexto mínimo para caja: solo instrucciones y si ya fue entregado el regalo.
CREATE OR REPLACE FUNCTION public.staff_card_context(p_membership uuid)
RETURNS TABLE(customer_label text,joined_at timestamptz,verified_visits bigint,
 earned_total integer,staff_notes jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 RETURN QUERY
 SELECT
  CASE WHEN nullif(btrim(coalesce(p.full_name,'')),'') IS NULL THEN 'Cliente'::text ELSE
   (split_part(btrim(p.full_name),' ',1) ||
    CASE WHEN split_part(btrim(p.full_name),' ',2)<>'' THEN
     ' '||upper(left(split_part(btrim(p.full_name),' ',2),1))||'.' ELSE '' END)::text
  END,
  m.created_at,
  (SELECT count(*) FROM public.loyalty_transactions t
   WHERE t.membership_id=m.id AND t.kind='earn'
   AND NOT EXISTS(SELECT 1 FROM public.loyalty_transactions x WHERE x.reversal_of=t.id)),
  m.total_earned,
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'rule_id',r.id,'name',r.name,'target',r.target_stamps,
    'expires_at',m.created_at+make_interval(days=>r.window_days),
    'instruction',r.staff_instruction,
    'redeemed',EXISTS(SELECT 1 FROM public.automation_bonus_claims c
       WHERE c.rule_id=r.id AND c.membership_id=m.id)
   ) ORDER BY r.target_stamps)
   FROM public.automation_rules r
   WHERE r.business_id=m.business_id AND r.active AND r.trigger_kind='stamps'
    AND r.staff_instruction<>'' AND now()<=m.created_at+make_interval(days=>r.window_days)
    AND (m.total_earned<r.target_stamps OR EXISTS(
      SELECT 1 FROM public.automation_queue q WHERE q.rule_id=r.id AND q.membership_id=m.id))
    AND EXISTS(SELECT 1 FROM public.loyalty_programs pr
       WHERE pr.business_id=m.business_id AND pr.type='stamps')
  ),'[]'::jsonb)
 FROM public.loyalty_memberships m JOIN public.profiles p ON p.id=m.customer_id
 WHERE m.id=p_membership AND public.is_business_staff(m.business_id)
 AND EXISTS(SELECT 1 FROM public.businesses b WHERE b.id=m.business_id AND b.active);
END $$;
REVOKE ALL ON FUNCTION public.staff_card_context(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_card_context(uuid) TO authenticated;
