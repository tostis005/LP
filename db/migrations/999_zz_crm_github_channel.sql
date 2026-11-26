-- Explicit authorization of GitHub commercial orders by a confirmed CRM admin.
-- Never store fiscal addresses or recipients in GitHub.
CREATE TABLE public.crm_github_channel (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 authorized_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 fiscal_address text NOT NULL CHECK (length(fiscal_address) BETWEEN 10 AND 500),
 enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.crm_github_orders (
 order_id text PRIMARY KEY CHECK (order_id ~ '^[0-9]{1,20}$'),
 state text NOT NULL DEFAULT 'started' CHECK (state IN ('started','completed','stopped')),
 queued integer NOT NULL DEFAULT 0 CHECK (queued BETWEEN 0 AND 30),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_github_channel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_github_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_github_channel_admin ON public.crm_github_channel FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY crm_github_orders_admin ON public.crm_github_orders FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
REVOKE ALL ON public.crm_github_channel,public.crm_github_orders FROM anon,PUBLIC;
GRANT SELECT,INSERT,UPDATE ON public.crm_github_channel,public.crm_github_orders TO authenticated;

CREATE FUNCTION public.crm_github_actor() RETURNS uuid
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
 AS $$ SELECT authorized_by FROM public.crm_github_channel WHERE id=true $$;
REVOKE ALL ON FUNCTION public.crm_github_actor() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_github_actor() TO lp_auth;
