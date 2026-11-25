-- Persistent commercial correspondence, independent of remote availability.
ALTER TABLE public.crm_mailbox ADD COLUMN IF NOT EXISTS logs_secret text;
CREATE TABLE public.crm_mail_history (
 mailbox text NOT NULL, source text NOT NULL CHECK(source IN ('inbox','logs')),
 external_id text NOT NULL, correspondent text NOT NULL,
 direction text NOT NULL CHECK(direction IN ('inbound','outbound')),
 occurred_at timestamptz NOT NULL, subject text NOT NULL DEFAULT '',
 body_text text NOT NULL DEFAULT '', delivery_status text NOT NULL,
 PRIMARY KEY(mailbox,source,external_id,correspondent)
);
CREATE INDEX crm_mail_history_contact_idx ON public.crm_mail_history(correspondent,occurred_at DESC);
CREATE INDEX crm_mail_history_contact_direction_idx ON public.crm_mail_history(correspondent,direction,occurred_at DESC);
CREATE TABLE public.crm_mail_sync (
 mailbox text NOT NULL, source text NOT NULL CHECK(source IN ('inbox','logs')),
 cursor text, window_start timestamptz, window_end timestamptz,
 last_finished timestamptz, lease uuid, started_at timestamptz,
 last_error text, PRIMARY KEY(mailbox,source)
);
ALTER TABLE public.crm_mail_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_mail_sync ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_mail_history_admin ON public.crm_mail_history FOR ALL TO authenticated USING(public.is_platform_admin()) WITH CHECK(public.is_platform_admin());
CREATE POLICY crm_mail_sync_admin ON public.crm_mail_sync FOR ALL TO authenticated USING(public.is_platform_admin()) WITH CHECK(public.is_platform_admin());
REVOKE ALL ON public.crm_mail_history,public.crm_mail_sync FROM anon,PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.crm_mail_history,public.crm_mail_sync TO authenticated;

-- Only the internal automation worker can resolve the authorizing administrator.
ALTER TABLE public.crm_mailbox ADD COLUMN IF NOT EXISTS sync_actor uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE FUNCTION public.crm_mail_sync_actor() RETURNS uuid
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
 AS $$ SELECT sync_actor FROM public.crm_mailbox WHERE id=true $$;
REVOKE ALL ON FUNCTION public.crm_mail_sync_actor() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_mail_sync_actor() TO lp_auth;
