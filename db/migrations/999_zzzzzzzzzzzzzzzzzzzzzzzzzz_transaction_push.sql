-- Private, unbilled transaction receipts, addressed to the device that presented its QR.
ALTER TABLE public.web_push_subscriptions ADD COLUMN IF NOT EXISTS transaction_opted_in boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS public.card_device_qrs(
 token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 membership_id uuid NOT NULL REFERENCES public.loyalty_memberships(id) ON DELETE CASCADE,
 subscription_id uuid NOT NULL REFERENCES public.web_push_subscriptions(id) ON DELETE CASCADE,
 customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 UNIQUE(membership_id,subscription_id)
);
ALTER TABLE public.card_device_qrs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.card_device_qrs FROM PUBLIC,anon,authenticated,lp_api,lp_auth;

CREATE OR REPLACE FUNCTION public.customer_device_card_qr(p_membership uuid,p_endpoint text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_subscription uuid; v_token uuid;
BEGIN
 SELECT s.id INTO v_subscription FROM public.web_push_subscriptions s
 JOIN public.loyalty_memberships m ON m.customer_id=s.customer_id
 WHERE m.id=p_membership AND m.customer_id=auth.uid() AND s.endpoint=p_endpoint AND s.active;
 IF NOT FOUND THEN RETURN NULL; END IF;
 INSERT INTO public.card_device_qrs(membership_id,subscription_id,customer_id)
 VALUES(p_membership,v_subscription,auth.uid())
 ON CONFLICT(membership_id,subscription_id) DO UPDATE SET customer_id=EXCLUDED.customer_id
 RETURNING token INTO v_token;
 RETURN v_token;
END $$;
REVOKE ALL ON FUNCTION public.customer_device_card_qr(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.customer_device_card_qr(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.customer_transaction_push_preference(p_endpoint text,p_enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_enabled boolean;
BEGIN
 IF p_enabled IS NOT NULL THEN
  UPDATE public.web_push_subscriptions SET transaction_opted_in=p_enabled
   WHERE customer_id=auth.uid() AND endpoint=p_endpoint AND active;
 END IF;
 SELECT transaction_opted_in INTO v_enabled FROM public.web_push_subscriptions
 WHERE customer_id=auth.uid() AND endpoint=p_endpoint AND active;
 RETURN v_enabled;
END $$;
REVOKE ALL ON FUNCTION public.customer_transaction_push_preference(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.customer_transaction_push_preference(text,boolean) TO authenticated;

-- Resolve old device aliases even after push is disabled, so saved or offline purchases still work.
-- Only the trusted backend sees the canonical token; normal staff authorization remains mandatory.
CREATE OR REPLACE FUNCTION public.resolve_device_card_token(p_token uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce((SELECT m.card_token FROM public.card_device_qrs q
 JOIN public.loyalty_memberships m ON m.id=q.membership_id WHERE q.token=p_token),p_token)
$$;
REVOKE ALL ON FUNCTION public.resolve_device_card_token(uuid) FROM PUBLIC,anon,authenticated,lp_api;
GRANT EXECUTE ON FUNCTION public.resolve_device_card_token(uuid) TO lp_auth;

CREATE TABLE IF NOT EXISTS public.transaction_push_receipts(
 transaction_id uuid PRIMARY KEY REFERENCES public.loyalty_transactions(id) ON DELETE CASCADE,
 membership_id uuid NOT NULL REFERENCES public.loyalty_memberships(id) ON DELETE CASCADE,
 subscription_id uuid NOT NULL REFERENCES public.web_push_subscriptions(id) ON DELETE CASCADE,
 customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 business_name text NOT NULL, program_type text NOT NULL, currency text NOT NULL,
 amount_delta integer NOT NULL, balance integer NOT NULL, reward_cost integer NOT NULL, reward_label text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','sending','sent','failed')),
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 reserved_at timestamptz, sent_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transaction_push_due ON public.transaction_push_receipts(next_attempt_at) WHERE status IN('pending','sending');
ALTER TABLE public.transaction_push_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transaction_push_receipts FROM PUBLIC,anon,authenticated,lp_api,lp_auth;

CREATE OR REPLACE FUNCTION public.queue_transaction_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_alias text:=current_setting('kreyvi.card_device_qr',true);
BEGIN
 IF NEW.kind<>'earn' OR NEW.amount_delta<=0 OR v_alias IS NULL OR v_alias!~*'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' THEN RETURN NEW; END IF;
 -- apply_staff_award locks the membership, inserts the transaction and then updates its balance.
 -- This event is committed atomically with the real award, never with an unconfirmed scan.
 INSERT INTO public.transaction_push_receipts(transaction_id,membership_id,subscription_id,customer_id,business_name,program_type,currency,amount_delta,balance,reward_cost,reward_label)
 SELECT NEW.id,m.id,s.id,m.customer_id,b.name,p.type,coalesce(b.currency,'MXN'),NEW.amount_delta,m.balance+NEW.amount_delta,p.reward_cost,coalesce(p.reward_label,'Tu recompensa')
 FROM public.card_device_qrs q
 JOIN public.loyalty_memberships m ON m.id=q.membership_id AND m.customer_id=q.customer_id
 JOIN public.web_push_subscriptions s ON s.id=q.subscription_id AND s.customer_id=m.customer_id
 JOIN public.businesses b ON b.id=m.business_id
 JOIN public.loyalty_programs p ON p.business_id=b.id
 WHERE q.token=v_alias::uuid AND m.id=NEW.membership_id AND m.business_id=NEW.business_id
 AND s.active AND s.transaction_opted_in
 ON CONFLICT(transaction_id) DO NOTHING;
 IF FOUND THEN PERFORM set_config('kreyvi.transaction_push_id',NEW.id::text,true); END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.queue_transaction_push() FROM PUBLIC,anon,authenticated,lp_api,lp_auth;
DROP TRIGGER IF EXISTS queue_transaction_push ON public.loyalty_transactions;
CREATE TRIGGER queue_transaction_push AFTER INSERT ON public.loyalty_transactions FOR EACH ROW EXECUTE FUNCTION public.queue_transaction_push();

CREATE OR REPLACE FUNCTION public.claim_transaction_push(p_transaction uuid DEFAULT NULL)
RETURNS TABLE(delivery_id uuid,endpoint text,p256dh text,auth text,membership_id uuid,business_name text,program_type text,currency text,amount_delta integer,balance integer,reward_cost integer,reward_label text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 -- Expired events, account switches, opt-outs and reversed purchases cannot be sent.
 UPDATE public.transaction_push_receipts r SET status='failed',reserved_at=NULL
 WHERE r.status IN('pending','sending') AND (p_transaction IS NULL OR r.transaction_id=p_transaction)
 AND (r.created_at<now()-interval '24 hours' OR r.attempts>=5 OR NOT EXISTS(
  SELECT 1 FROM public.web_push_subscriptions s WHERE s.id=r.subscription_id AND s.customer_id=r.customer_id AND s.active AND s.transaction_opted_in
 ) OR EXISTS(SELECT 1 FROM public.loyalty_transactions t WHERE t.reversal_of=r.transaction_id));
 SELECT r.transaction_id INTO v_id FROM public.transaction_push_receipts r
 JOIN public.web_push_subscriptions s ON s.id=r.subscription_id AND s.customer_id=r.customer_id AND s.active AND s.transaction_opted_in
 WHERE (p_transaction IS NULL OR r.transaction_id=p_transaction) AND r.next_attempt_at<=now()
 AND (r.status='pending' OR (r.status='sending' AND r.reserved_at<now()-interval '2 minutes'))
 ORDER BY r.next_attempt_at,r.created_at LIMIT 1 FOR UPDATE OF r SKIP LOCKED;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.transaction_push_receipts r SET status='sending',reserved_at=now(),attempts=r.attempts+1 WHERE r.transaction_id=v_id;
 RETURN QUERY SELECT r.transaction_id,s.endpoint,s.p256dh,s.auth,r.membership_id,r.business_name,r.program_type,r.currency,r.amount_delta,r.balance,r.reward_cost,r.reward_label
 FROM public.transaction_push_receipts r JOIN public.web_push_subscriptions s ON s.id=r.subscription_id
 WHERE r.transaction_id=v_id AND s.customer_id=r.customer_id AND s.active AND s.transaction_opted_in;
END $$;
REVOKE ALL ON FUNCTION public.claim_transaction_push(uuid) FROM PUBLIC,anon,authenticated,lp_api;
GRANT EXECUTE ON FUNCTION public.claim_transaction_push(uuid) TO lp_auth;

CREATE OR REPLACE FUNCTION public.finish_transaction_push(p_transaction uuid,p_success boolean,p_expired boolean,p_retry boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.transaction_push_receipts%rowtype;
BEGIN
 SELECT * INTO r FROM public.transaction_push_receipts WHERE transaction_id=p_transaction AND status='sending' FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.transaction_push_receipts SET status=CASE WHEN p_success THEN 'sent' WHEN p_retry AND r.attempts<5 THEN 'pending' ELSE 'failed' END,
 reserved_at=NULL,sent_at=CASE WHEN p_success THEN now() ELSE NULL END,
 next_attempt_at=now()+make_interval(secs=>60*r.attempts) WHERE transaction_id=p_transaction;
 IF p_expired THEN UPDATE public.web_push_subscriptions SET active=false,updated_at=now()
 WHERE id=r.subscription_id AND customer_id=r.customer_id; END IF;
END $$;
REVOKE ALL ON FUNCTION public.finish_transaction_push(uuid,boolean,boolean,boolean) FROM PUBLIC,anon,authenticated,lp_api;
GRANT EXECUTE ON FUNCTION public.finish_transaction_push(uuid,boolean,boolean,boolean) TO lp_auth;
