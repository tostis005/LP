-- CRM comercial: independiente de clientes y solicitudes entrantes.
CREATE TABLE public.crm_prospects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source text NOT NULL DEFAULT 'DENUE',
 source_id text NOT NULL,
 name text NOT NULL,
 country_code text NOT NULL DEFAULT 'MX',
 state_code text NOT NULL,
 state text NOT NULL,
 municipality_code text NOT NULL,
 municipality text NOT NULL,
 locality_code text NOT NULL,
 city text NOT NULL,
 activity_code text NOT NULL,
 activity text NOT NULL,
 category text NOT NULL,
 email text NOT NULL,
 website text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','qualified','contacted','interested','trial','converted','discarded','do_not_contact')),
 notes text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source,source_id),
 CHECK (length(email) BETWEEN 3 AND 254)
);
CREATE INDEX crm_prospects_geo_idx ON public.crm_prospects(country_code,state_code,municipality_code,locality_code,category);
CREATE INDEX crm_prospects_email_idx ON public.crm_prospects(lower(email));
CREATE INDEX crm_prospects_status_idx ON public.crm_prospects(status);
ALTER TABLE public.crm_prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_admin_only ON public.crm_prospects FOR ALL TO authenticated
 USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
GRANT SELECT, INSERT, UPDATE ON public.crm_prospects TO authenticated;
REVOKE ALL ON public.crm_prospects FROM anon, PUBLIC;

CREATE TABLE public.crm_import_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 filename text NOT NULL,
 source text NOT NULL DEFAULT 'DENUE',
 report jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_import_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_import_admin_only ON public.crm_import_runs FOR ALL TO authenticated
 USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
GRANT SELECT, INSERT ON public.crm_import_runs TO authenticated;
REVOKE ALL ON public.crm_import_runs FROM anon, PUBLIC;

-- Persistent exclusion by address, even if a later import contains another outlet.
CREATE TABLE public.crm_email_exclusions (
 email text PRIMARY KEY CHECK (email=lower(email)),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_email_exclusions ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_exclusions_admin_only ON public.crm_email_exclusions FOR ALL TO authenticated
 USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
GRANT SELECT,INSERT ON public.crm_email_exclusions TO authenticated;
REVOKE ALL ON public.crm_email_exclusions FROM anon, PUBLIC;
