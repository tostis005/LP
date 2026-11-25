-- One dedicated commercial mailbox; credentials encrypted by the application.
CREATE TABLE public.crm_mailbox (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 email text NOT NULL,
 secret text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_mailbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_mailbox_admin ON public.crm_mailbox FOR ALL TO authenticated
 USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
REVOKE ALL ON public.crm_mailbox FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_mailbox TO authenticated;
