ALTER TABLE public.crm_prospects ADD COLUMN IF NOT EXISTS facebook text NOT NULL DEFAULT '';
ALTER TABLE public.crm_prospects ADD COLUMN IF NOT EXISTS whatsapp text NOT NULL DEFAULT '';
ALTER TABLE public.crm_prospects ADD COLUMN IF NOT EXISTS source_url text NOT NULL DEFAULT '';
ALTER TABLE public.crm_prospects ADD COLUMN IF NOT EXISTS source_data jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE public.crm_staged_csv (
 filename text PRIMARY KEY CHECK (filename ~ '^osm-venezuela-[0-9]{8}[.]csv$'),
 sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
 data bytea NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 20971520),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_staged_csv ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_staged_admin ON public.crm_staged_csv FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
REVOKE ALL ON public.crm_staged_csv FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.crm_staged_csv TO authenticated;
