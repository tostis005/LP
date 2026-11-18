-- Un QR de premio único por tarjeta al alcanzar el umbral. No equivale al QR de cliente.
CREATE TABLE IF NOT EXISTS public.reward_vouchers(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 membership_id uuid NOT NULL REFERENCES public.loyalty_memberships(id) ON DELETE CASCADE,
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 reward_label text NOT NULL,
 status text NOT NULL DEFAULT 'issued' CHECK(status IN ('issued','redeemed','cancelled')),
 issued_at timestamptz NOT NULL DEFAULT now(),
 redeemed_at timestamptz,
 redeemed_by uuid REFERENCES auth.users(id),
 email_sent_at timestamptz,
 email_reserved_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_issued_voucher_per_card
 ON public.reward_vouchers(membership_id) WHERE status='issued';
CREATE INDEX IF NOT EXISTS reward_vouchers_business_idx ON public.reward_vouchers(business_id,issued_at);
ALTER TABLE public.reward_vouchers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vouchers_read ON public.reward_vouchers;
CREATE POLICY vouchers_read ON public.reward_vouchers FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.loyalty_memberships m
  WHERE m.id=membership_id AND m.customer_id=auth.uid())
 OR public.is_business_staff(business_id) OR public.is_platform_admin()
);

CREATE OR REPLACE FUNCTION public.issue_reward_voucher()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_program public.loyalty_programs%rowtype;
BEGIN
 SELECT * INTO v_program FROM public.loyalty_programs WHERE business_id=new.business_id;
 IF NOT FOUND OR v_program.reward_cost<=0 THEN RETURN new; END IF;
 IF new.balance < v_program.reward_cost THEN
  UPDATE public.reward_vouchers SET status='cancelled'
   WHERE membership_id=new.id AND status='issued';
 ELSIF NOT EXISTS(SELECT 1 FROM public.reward_vouchers
                   WHERE membership_id=new.id AND status='issued') THEN
  INSERT INTO public.reward_vouchers(membership_id,business_id,reward_label)
   VALUES(new.id,new.business_id,v_program.reward_label);
 END IF;
 RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_issue_voucher ON public.loyalty_memberships;
CREATE TRIGGER trg_issue_voucher AFTER INSERT OR UPDATE OF balance
 ON public.loyalty_memberships FOR EACH ROW EXECUTE FUNCTION public.issue_reward_voucher();

CREATE OR REPLACE FUNCTION public.staff_lookup_voucher(p_token uuid)
RETURNS TABLE(membership_id uuid,business_id uuid,business_name text,customer_name text,
 program_type text,balance integer,reward_label text,reward_cost integer,voucher_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 RETURN QUERY SELECT m.id,b.id,b.name,p.full_name,pr.type,m.balance,v.reward_label,pr.reward_cost,v.id
 FROM public.reward_vouchers v
 JOIN public.loyalty_memberships m ON m.id=v.membership_id
 JOIN public.businesses b ON b.id=v.business_id
 JOIN public.loyalty_programs pr ON pr.business_id=b.id
 JOIN public.profiles p ON p.id=m.customer_id
 WHERE v.token=p_token AND v.status='issued' AND m.balance>=pr.reward_cost
 AND b.active AND public.is_business_staff(v.business_id);
END $$;
REVOKE ALL ON FUNCTION public.staff_lookup_voucher(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_lookup_voucher(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_redeem_voucher(p_token uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_voucher public.reward_vouchers%rowtype; v_m public.loyalty_memberships%rowtype;
 v_p public.loyalty_programs%rowtype; v_balance integer;
BEGIN
 SELECT * INTO v_voucher FROM public.reward_vouchers WHERE token=p_token FOR UPDATE;
 IF NOT FOUND OR v_voucher.status<>'issued' THEN RAISE EXCEPTION 'QR no disponible o ya canjeado'; END IF;
 SELECT * INTO v_m FROM public.loyalty_memberships WHERE id=v_voucher.membership_id FOR UPDATE;
 SELECT * INTO v_p FROM public.loyalty_programs WHERE business_id=v_m.business_id;
 IF NOT public.is_business_staff(v_m.business_id)
   OR NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=v_m.business_id AND active) THEN
  RAISE EXCEPTION 'Acceso denegado'; END IF;
 IF v_m.balance<v_p.reward_cost THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
 UPDATE public.reward_vouchers
  SET status='redeemed',redeemed_at=now(),redeemed_by=auth.uid()
  WHERE id=v_voucher.id;
 -- Se descuenta mediante la función ya validada y auditada, con sus límites.
 SELECT public.staff_redeem_card(v_m.card_token,
   CASE WHEN v_p.type='cashback' THEN v_p.reward_cost ELSE NULL END) INTO v_balance;
 RETURN v_balance;
END $$;
REVOKE ALL ON FUNCTION public.staff_redeem_voucher(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_redeem_voucher(uuid) TO authenticated;

-- El servicio transaccional solamente puede leer los datos necesarios para los avisos.
GRANT SELECT,UPDATE(email_sent_at,email_reserved_at) ON public.reward_vouchers TO lp_auth;
GRANT SELECT ON public.loyalty_memberships,public.businesses TO lp_auth;
