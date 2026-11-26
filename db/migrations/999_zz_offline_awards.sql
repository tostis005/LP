-- Revocaciones efectivas en servidor, incluso si el dispositivo no recibió el aviso.
ALTER TABLE public.business_members ADD COLUMN IF NOT EXISTS offline_revision uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.business_members ADD COLUMN IF NOT EXISTS access_changed_at timestamptz NOT NULL DEFAULT clock_timestamp();
CREATE TABLE IF NOT EXISTS public.staff_access_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),business_id uuid NOT NULL,user_id uuid NOT NULL,
 active boolean NOT NULL,role text NOT NULL,changed_at timestamptz NOT NULL,changed_by uuid
);
ALTER TABLE public.staff_access_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_access_events FROM PUBLIC,anon,authenticated,lp_api;
CREATE OR REPLACE FUNCTION public.track_staff_access_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.active IS NOT DISTINCT FROM OLD.active AND NEW.role IS NOT DISTINCT FROM OLD.role THEN
   NEW.offline_revision:=OLD.offline_revision; NEW.access_changed_at:=OLD.access_changed_at; RETURN NEW;
  END IF;
 END IF;
 NEW.offline_revision:=gen_random_uuid(); NEW.access_changed_at:=clock_timestamp();
 INSERT INTO public.staff_access_events(business_id,user_id,active,role,changed_at,changed_by)
 VALUES(NEW.business_id,NEW.user_id,NEW.active,NEW.role,NEW.access_changed_at,auth.uid());
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS track_staff_access_change ON public.business_members;
CREATE TRIGGER track_staff_access_change BEFORE INSERT OR UPDATE ON public.business_members FOR EACH ROW EXECUTE FUNCTION public.track_staff_access_change();
REVOKE ALL ON FUNCTION public.track_staff_access_change() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.staff_offline_access()
RETURNS TABLE(business_id uuid,revision uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT m.business_id,m.offline_revision FROM public.business_members m JOIN public.businesses b ON b.id=m.business_id AND b.active
 WHERE m.user_id=auth.uid() AND m.active AND m.role='employee'
$$;
REVOKE ALL ON FUNCTION public.staff_offline_access() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_offline_access() TO authenticated;

-- Hora de captura declarada y hora de confirmación separadas. Los informes y
-- automatizaciones conservan created_at como fecha contable de confirmación.
ALTER TABLE public.loyalty_transactions ADD COLUMN IF NOT EXISTS captured_at timestamptz;
CREATE INDEX IF NOT EXISTS loyalty_earn_capture_card ON public.loyalty_transactions(membership_id,(coalesce(captured_at,created_at))) WHERE kind='earn';
CREATE INDEX IF NOT EXISTS loyalty_earn_capture_staff ON public.loyalty_transactions(business_id,employee_id,(coalesce(captured_at,created_at))) WHERE kind='earn';
CREATE OR REPLACE FUNCTION public.guard_loyalty_award()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_limit integer; v_require boolean; v_gap integer; v_count bigint; v_start timestamptz; v_at timestamptz;
BEGIN
 IF NEW.kind<>'earn' THEN RETURN NEW; END IF;
 IF auth.uid() IS NULL OR NEW.employee_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'El empleado no coincide con la sesión'; END IF;
 -- El bloqueo serializa con bajas y cambios de rol.
 PERFORM 1 FROM public.business_members WHERE business_id=NEW.business_id AND user_id=auth.uid() AND active FOR SHARE;
 IF NOT FOUND OR NOT public.is_business_staff(NEW.business_id) THEN RAISE EXCEPTION 'El usuario no pertenece a este negocio'; END IF;
 SELECT max_daily_awards_per_employee,require_ticket_reference,min_seconds_between_awards INTO v_limit,v_require,v_gap
 FROM public.loyalty_programs WHERE business_id=NEW.business_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Programa inexistente'; END IF;
 IF v_require AND nullif(btrim(coalesce(NEW.ticket_ref,'')),'') IS NULL THEN RAISE EXCEPTION 'Este negocio requiere la referencia del ticket'; END IF;
 v_at:=coalesce(NEW.captured_at,NEW.created_at);
 PERFORM pg_advisory_xact_lock(hashtext(NEW.business_id::text),hashtext(NEW.employee_id::text));
 IF v_gap>0 AND EXISTS(SELECT 1 FROM public.loyalty_transactions t WHERE t.membership_id=NEW.membership_id AND t.kind='earn'
  AND coalesce(t.captured_at,t.created_at)>v_at-make_interval(secs=>v_gap)
  AND coalesce(t.captured_at,t.created_at)<v_at+make_interval(secs=>v_gap))
 THEN RAISE EXCEPTION 'Espera antes de registrar otra compra en esta tarjeta'; END IF;
 v_start:=date_trunc('day',v_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 SELECT count(*) INTO v_count FROM public.loyalty_transactions WHERE business_id=NEW.business_id AND employee_id=NEW.employee_id AND kind='earn'
 AND coalesce(captured_at,created_at)>=v_start AND coalesce(captured_at,created_at)<v_start+interval '1 day';
 IF v_count>=v_limit THEN RAISE EXCEPTION 'Se ha alcanzado el máximo diario de operaciones de este empleado'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.apply_staff_award(p_token uuid,p_purchase_cents integer,p_stamps integer,p_ticket_ref text,p_captured_at timestamptz,p_revision uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_m public.loyalty_memberships%rowtype; v_p public.loyalty_programs%rowtype;
 v_delta integer; v_ref text;
BEGIN
 SELECT * INTO v_m FROM public.loyalty_memberships WHERE card_token=p_token FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tarjeta no encontrada'; END IF;
 IF NOT public.is_business_staff(v_m.business_id)
  OR NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=v_m.business_id AND active)
 THEN RAISE EXCEPTION 'Acceso denegado'; END IF;
 SELECT * INTO v_p FROM public.loyalty_programs WHERE business_id=v_m.business_id;
 IF (v_p.require_purchase_amount OR v_p.type<>'stamps') AND coalesce(p_purchase_cents,0)<1 THEN RAISE EXCEPTION 'Indica el importe de la compra'; END IF;
 IF coalesce(p_purchase_cents,0)<0 OR p_purchase_cents>v_p.max_ticket_cents
 THEN RAISE EXCEPTION 'Importe de compra fuera del límite'; END IF;
 IF v_p.require_ticket_reference AND nullif(btrim(coalesce(p_ticket_ref,'')),'') IS NULL
 THEN RAISE EXCEPTION 'Indica la referencia del ticket'; END IF;
 IF v_p.type='stamps' THEN
  IF p_stamps IS NULL OR p_stamps<1 OR p_stamps>v_p.max_stamps_per_action THEN RAISE EXCEPTION 'Sellos fuera del límite'; END IF;
  v_delta:=p_stamps;
 ELSE
  IF p_purchase_cents<1 THEN RAISE EXCEPTION 'Indica un importe positivo'; END IF;
  v_delta:=CASE WHEN v_p.type='cashback'
   THEN floor(p_purchase_cents::numeric*v_p.cashback_bps/10000)::int
   ELSE floor(p_purchase_cents::numeric*v_p.points_per_euro/100)::int END;
  IF v_delta<1 THEN RAISE EXCEPTION 'Importe demasiado pequeño para generar saldo'; END IF;
 END IF;
 v_ref:=nullif(left(btrim(coalesce(p_ticket_ref,'')),100),'');
 INSERT INTO public.loyalty_transactions(business_id,membership_id,employee_id,kind,amount_delta,purchase_cents,ticket_ref,captured_at)
 VALUES(v_m.business_id,v_m.id,auth.uid(),'earn',v_delta,
   nullif(p_purchase_cents,0),v_ref,p_captured_at);
 UPDATE public.loyalty_memberships
  SET balance=balance+v_delta,total_earned=total_earned+v_delta WHERE id=v_m.id;
 RETURN v_m.balance+v_delta;
END $$;

REVOKE ALL ON FUNCTION public.apply_staff_award(uuid,integer,integer,text,timestamptz) FROM PUBLIC,anon,authenticated,lp_api;
CREATE OR REPLACE FUNCTION public.staff_award_card(p_token uuid,p_purchase_cents integer DEFAULT 0,p_stamps integer DEFAULT 1,p_ticket_ref text DEFAULT null)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT public.apply_staff_award(p_token,p_purchase_cents,p_stamps,p_ticket_ref,NULL)
$$;
REVOKE ALL ON FUNCTION public.staff_award_card(uuid,integer,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_award_card(uuid,integer,integer,text) TO authenticated;
-- Idempotencia transaccional: una respuesta perdida nunca duplica una compra.
CREATE TABLE IF NOT EXISTS public.offline_award_receipts(
 operation_id uuid PRIMARY KEY, actor_id uuid NOT NULL, business_id uuid NOT NULL,
 card_token uuid NOT NULL, purchase_cents integer NOT NULL, stamps integer NOT NULL,
 ticket_ref text, captured_at timestamptz NOT NULL, balance integer NOT NULL,
 confirmed_at timestamptz NOT NULL DEFAULT now(), revision uuid NOT NULL
);
ALTER TABLE public.offline_award_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.offline_award_receipts FROM PUBLIC,anon,authenticated,lp_api;
CREATE OR REPLACE FUNCTION public.staff_sync_award(p_operation uuid,p_actor uuid,p_business uuid,p_token uuid,p_purchase_cents integer,p_stamps integer,p_ticket_ref text,p_captured_at timestamptz)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.offline_award_receipts%rowtype; v_balance integer; v_access public.business_members%rowtype; v_joined timestamptz;
BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'Sesión o permisos no válidos para sincronizar'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_operation::text,0));
 SELECT * INTO r FROM public.offline_award_receipts WHERE operation_id=p_operation;
 IF FOUND THEN
  IF r.actor_id IS DISTINCT FROM p_actor OR r.business_id IS DISTINCT FROM p_business OR r.card_token IS DISTINCT FROM p_token
   OR r.purchase_cents IS DISTINCT FROM p_purchase_cents OR r.stamps IS DISTINCT FROM p_stamps
   OR r.ticket_ref IS DISTINCT FROM p_ticket_ref OR r.captured_at IS DISTINCT FROM p_captured_at OR r.revision IS DISTINCT FROM p_revision
  THEN RAISE EXCEPTION 'Identificador de operación ya utilizado'; END IF;
  RETURN r.balance;
 END IF;
 SELECT * INTO v_access FROM public.business_members WHERE business_id=p_business AND user_id=p_actor FOR SHARE;
 IF NOT FOUND OR NOT v_access.active OR v_access.role<>'employee' OR v_access.offline_revision IS DISTINCT FROM p_revision
 THEN RAISE EXCEPTION 'Permisos revocados o modificados: compra pendiente no autorizada'; END IF;
 IF p_captured_at IS NULL OR p_captured_at>clock_timestamp()+interval '5 minutes'
 THEN RAISE EXCEPTION 'Fecha de compra no válida'; END IF;
 SELECT created_at INTO v_joined FROM public.loyalty_memberships WHERE card_token=p_token AND business_id=p_business;
 IF NOT FOUND THEN RAISE EXCEPTION 'La tarjeta no pertenece a este establecimiento'; END IF;
 IF p_captured_at<v_access.access_changed_at OR p_captured_at<v_joined THEN RAISE EXCEPTION 'Fecha anterior a la autorización o al alta de la tarjeta'; END IF;
 -- Misma lógica de saldo y controles que online, pero por hora de captura.
 v_balance:=public.apply_staff_award(p_token,p_purchase_cents,p_stamps,p_ticket_ref,p_captured_at);
 INSERT INTO public.offline_award_receipts(operation_id,actor_id,business_id,card_token,purchase_cents,stamps,ticket_ref,captured_at,balance,revision)
 VALUES(p_operation,p_actor,p_business,p_token,p_purchase_cents,p_stamps,p_ticket_ref,p_captured_at,v_balance,p_revision);
 RETURN v_balance;
END $$;
REVOKE ALL ON FUNCTION public.staff_sync_award(uuid,uuid,uuid,uuid,integer,integer,text,timestamptz,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_sync_award(uuid,uuid,uuid,uuid,integer,integer,text,timestamptz,uuid) TO authenticated;
