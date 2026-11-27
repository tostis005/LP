CREATE TABLE public.waitlist_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
 country text NOT NULL CHECK (country IN ('MX','ES')),
 whatsapp text NOT NULL UNIQUE CHECK (whatsapp ~ '^(\+52[0-9]{10}|\+34[0-9]{9})$'),
 email text,
 city text NOT NULL CHECK (char_length(city) BETWEEN 2 AND 120),
 city_key text NOT NULL,
 kind text NOT NULL CHECK (kind IN ('user','business')),
 business_name text,
 business_type text CHECK (business_type IN ('cafe','restaurant','other')),
 branches integer CHECK (branches BETWEEN 1 AND 10000),
 privacy_version text NOT NULL,
 pixel_consent boolean NOT NULL DEFAULT false,
 utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text, utm_id text,
 CHECK ((kind='user' AND business_name IS NULL AND business_type IS NULL AND branches IS NULL) OR
 (kind='business' AND business_name IS NOT NULL AND business_type IS NOT NULL AND branches IS NOT NULL))
);
CREATE INDEX waitlist_city_kind_idx ON public.waitlist_entries(country,city_key,kind);
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.waitlist_entries FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.waitlist_entries TO lp_auth;
CREATE POLICY waitlist_server_read ON public.waitlist_entries FOR SELECT TO lp_auth USING (true);
CREATE POLICY waitlist_server_insert ON public.waitlist_entries FOR INSERT TO lp_auth WITH CHECK (true);
