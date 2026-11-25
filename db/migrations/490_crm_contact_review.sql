-- Track review separately from commercial pipeline and contact availability.
ALTER TABLE public.crm_prospects ADD COLUMN contact_review text NOT NULL DEFAULT 'pending' CHECK (contact_review IN ('pending','source_found','no_contact_found','ambiguous','not_relevant'));
ALTER TABLE public.crm_prospects ADD COLUMN contact_review_url text CHECK (contact_review_url IS NULL OR length(contact_review_url)<=2048);
ALTER TABLE public.crm_prospects ADD COLUMN contact_reviewed_at timestamptz;
UPDATE public.crm_prospects SET contact_review='source_found',contact_review_url=public_email_source,contact_reviewed_at=public_email_checked_at WHERE public_email IS NOT NULL;
CREATE INDEX crm_contact_review_idx ON public.crm_prospects(contact_review);
