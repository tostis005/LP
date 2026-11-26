-- The requested amount is independent of the explicitly authorized daily quota.
ALTER TABLE public.crm_github_channel ADD COLUMN daily_limit integer DEFAULT 30 CHECK(daily_limit IS NULL OR daily_limit>0);
ALTER TABLE public.crm_github_orders ADD COLUMN requested_count integer NOT NULL DEFAULT 30 CHECK(requested_count>0);
ALTER TABLE public.crm_github_orders DROP CONSTRAINT crm_github_orders_queued_check;
ALTER TABLE public.crm_github_orders ADD CONSTRAINT crm_github_orders_queued_check CHECK(queued>=0 AND queued<=requested_count);
