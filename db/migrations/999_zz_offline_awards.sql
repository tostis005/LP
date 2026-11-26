-- Idempotencia transaccional: una respuesta perdida nunca duplica una compra.
CREATE TABLE IF NOT EXISTS public.offline_award_receipts(
 operation_id uuid PRIMARY KEY, actor_id uuid NOT NULL, business_id uuid NOT NULL,
 card_token uuid NOT NULL, purchase_cents integer NOT NULL, stamps integer NOT NULL,
 ticket_ref text, captured_at timestamptz NOT NULL, balance integer NOT NULL,
 confirmed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.offline_award_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.offline_award_receipts FROM PUBLIC,anon,authenticated,lp_api;
CREATE OR REPLACE FUNCTION public.staff_sync_award(p_operation uuid,p_actor uuid,p_business uuid,p_token uuid,p_purchase_cents integer,p_stamps integer,p_ticket_ref text,p_captured_at timestamptz)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.offline_award_receipts%rowtype; v_balance integer;
BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor OR NOT public.is_business_staff(p_business)
 THEN RAISE EXCEPTION 'Sesión o permisos no válidos para sincronizar'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_operation::text,0));
 SELECT * INTO r FROM public.offline_award_receipts WHERE operation_id=p_operation;
 IF FOUND THEN
  IF r.actor_id IS DISTINCT FROM p_actor OR r.business_id IS DISTINCT FROM p_business OR r.card_token IS DISTINCT FROM p_token
   OR r.purchase_cents IS DISTINCT FROM p_purchase_cents OR r.stamps IS DISTINCT FROM p_stamps
   OR r.ticket_ref IS DISTINCT FROM p_ticket_ref OR r.captured_at IS DISTINCT FROM p_captured_at
  THEN RAISE EXCEPTION 'Identificador de operación ya utilizado'; END IF;
  RETURN r.balance;
 END IF;
 IF p_captured_at IS NULL OR p_captured_at<now()-interval '24 hours' OR p_captured_at>now()+interval '5 minutes'
 THEN RAISE EXCEPTION 'La compra está fuera del plazo de sincronización'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.loyalty_memberships WHERE card_token=p_token AND business_id=p_business)
 THEN RAISE EXCEPTION 'La tarjeta no pertenece a este establecimiento'; END IF;
 -- Conserva los permisos, importes, referencias, límites y bloqueo de la función oficial.
 v_balance:=public.staff_award_card(p_token,p_purchase_cents,p_stamps,p_ticket_ref);
 INSERT INTO public.offline_award_receipts(operation_id,actor_id,business_id,card_token,purchase_cents,stamps,ticket_ref,captured_at,balance)
 VALUES(p_operation,p_actor,p_business,p_token,p_purchase_cents,p_stamps,p_ticket_ref,p_captured_at,v_balance);
 RETURN v_balance;
END $$;
REVOKE ALL ON FUNCTION public.staff_sync_award(uuid,uuid,uuid,uuid,integer,integer,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_sync_award(uuid,uuid,uuid,uuid,integer,integer,text,timestamptz) TO authenticated;
