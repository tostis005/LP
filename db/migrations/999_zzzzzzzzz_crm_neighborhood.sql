-- DENUE geography and social URLs. Empty values mean not published/unknown.
ALTER TABLE public.crm_prospects ADD COLUMN IF NOT EXISTS neighborhood text NOT NULL DEFAULT '';
ALTER TABLE public.crm_prospects ADD COLUMN IF NOT EXISTS postal_code text NOT NULL DEFAULT '';
ALTER TABLE public.crm_prospects ADD COLUMN IF NOT EXISTS instagram text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS crm_prospects_geo_neighborhood_idx ON public.crm_prospects(country_code,state_code,municipality_code,locality_code,neighborhood);
