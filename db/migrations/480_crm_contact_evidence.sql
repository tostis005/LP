-- Keep the original directory address and reviewed public contact evidence separate.
ALTER TABLE public.crm_prospects ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.crm_prospects ADD COLUMN public_email text CHECK (public_email IS NULL OR length(public_email) BETWEEN 3 AND 254);
ALTER TABLE public.crm_prospects ADD COLUMN public_email_source text CHECK (public_email_source IS NULL OR length(public_email_source)<=2048);
ALTER TABLE public.crm_prospects ADD COLUMN public_email_checked_at timestamptz;
ALTER TABLE public.crm_prospects ADD CONSTRAINT crm_public_evidence_complete CHECK (
 (public_email IS NULL AND public_email_source IS NULL AND public_email_checked_at IS NULL)
 OR (public_email IS NOT NULL AND public_email_source IS NOT NULL AND public_email_checked_at IS NOT NULL)
);
CREATE INDEX crm_public_email_idx ON public.crm_prospects(lower(public_email));
