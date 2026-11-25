-- Preserve directory contact fields separately from commercial notes and status.
ALTER TABLE public.crm_prospects ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';
ALTER TABLE public.crm_prospects ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '';
ALTER TABLE public.crm_prospects ADD COLUMN IF NOT EXISTS latitude text NOT NULL DEFAULT '';
ALTER TABLE public.crm_prospects ADD COLUMN IF NOT EXISTS longitude text NOT NULL DEFAULT '';
