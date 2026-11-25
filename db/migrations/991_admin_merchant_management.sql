-- Platform administrators may operate an active establishment without impersonating
-- its owner, creating memberships, or changing the actual authenticated actor.
-- Staff/owner permissions remain unchanged; only the manager capability is extended.
CREATE OR REPLACE FUNCTION public.is_business_manager(p_business uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(
  SELECT 1 FROM public.business_members
  WHERE business_id=p_business AND user_id=auth.uid() AND active=true AND role IN ('owner','manager')
 ) OR (
  public.is_platform_admin()
  AND EXISTS(SELECT 1 FROM public.businesses WHERE id=p_business AND active=true)
 );
$$;

-- Record administrative actions without storing recipients, message bodies, or card data.
CREATE TABLE IF NOT EXISTS public.admin_business_actions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid NOT NULL,
 business_id uuid NOT NULL,
 entity text NOT NULL,
 operation text NOT NULL CHECK(operation IN ('INSERT','UPDATE','DELETE')),
 entity_id uuid,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_business_actions_business_idx ON public.admin_business_actions(business_id,created_at DESC);
ALTER TABLE public.admin_business_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_business_actions_read ON public.admin_business_actions;
CREATE POLICY admin_business_actions_read ON public.admin_business_actions FOR SELECT TO authenticated
 USING(public.is_platform_admin());
REVOKE ALL ON public.admin_business_actions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.admin_business_actions TO authenticated;

CREATE OR REPLACE FUNCTION public.record_admin_business_action()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor uuid:=auth.uid(); v_row jsonb; v_business uuid;
BEGIN
 IF v_actor IS NOT NULL AND public.is_platform_admin() THEN
  IF TG_OP='DELETE' THEN v_row:=to_jsonb(OLD); ELSE v_row:=to_jsonb(NEW); END IF;
  IF TG_TABLE_NAME='businesses' THEN v_business:=(v_row->>'id')::uuid;
  ELSE v_business:=(v_row->>'business_id')::uuid; END IF;
  IF v_business IS NOT NULL THEN
   INSERT INTO public.admin_business_actions(actor_id,business_id,entity,operation,entity_id)
   VALUES(v_actor,v_business,TG_TABLE_NAME,TG_OP,COALESCE(v_row->>'id',v_row->>'user_id')::uuid);
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
REVOKE ALL ON FUNCTION public.record_admin_business_action() FROM PUBLIC,anon,authenticated,lp_api,lp_auth;
DO $$
DECLARE v_table text;
BEGIN
 FOREACH v_table IN ARRAY ARRAY['businesses','loyalty_programs','reward_options','business_offers',
 'marketing_campaigns','push_campaigns','automation_rules','business_members','business_invitations','business_locations']
 LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS audit_admin_business_action ON public.%I',v_table);
  EXECUTE format('CREATE TRIGGER audit_admin_business_action AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.record_admin_business_action()',v_table);
 END LOOP;
END $$;
