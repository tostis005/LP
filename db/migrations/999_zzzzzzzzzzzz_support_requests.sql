-- Public help requests are separate from sales leads and visible only to administrators.
CREATE TABLE public.support_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK(char_length(name) BETWEEN 2 AND 120),
 email text NOT NULL CHECK(char_length(email) BETWEEN 5 AND 254),
 topic text NOT NULL CHECK(topic IN ('wallet','card','account','rewards','privacy','other')),
 message text NOT NULL CHECK(char_length(message) BETWEEN 10 AND 2000),
 status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','resolved')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_requests_email_recent ON public.support_requests(email,created_at DESC);
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE(status) ON public.support_requests TO authenticated;
CREATE POLICY support_admin_read ON public.support_requests FOR SELECT TO authenticated USING(public.is_platform_admin());
CREATE POLICY support_admin_update ON public.support_requests FOR UPDATE TO authenticated USING(public.is_platform_admin()) WITH CHECK(public.is_platform_admin());
CREATE FUNCTION public.submit_support_request(n text,e text,t text,m text) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 DECLARE v_id uuid;
 BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('support:'||lower(e)));
  IF (SELECT count(*) FROM public.support_requests WHERE email=lower(e) AND created_at>now()-interval '1 hour')>=3 THEN
   RAISE EXCEPTION 'Demasiadas solicitudes. Inténtalo más tarde.';
  END IF;
  INSERT INTO public.support_requests(name,email,topic,message) VALUES(btrim(n),lower(btrim(e)),t,btrim(m)) RETURNING id INTO v_id;
  RETURN v_id;
 END $$;
REVOKE ALL ON FUNCTION public.submit_support_request(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_support_request(text,text,text,text) TO lp_auth;
