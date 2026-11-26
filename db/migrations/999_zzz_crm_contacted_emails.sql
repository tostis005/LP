-- Email is the identity of a first commercial contact, across all cities.
-- Preserve historical evidence independently of individual prospect records.
CREATE TABLE public.crm_contacted_emails (
 email text PRIMARY KEY CHECK(email<>'' AND email=lower(btrim(email))),
 first_contacted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_contacted_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_contacted_emails_admin ON public.crm_contacted_emails FOR ALL TO authenticated
 USING(public.is_platform_admin()) WITH CHECK(public.is_platform_admin());
REVOKE ALL ON public.crm_contacted_emails FROM anon,PUBLIC;
GRANT SELECT,INSERT ON public.crm_contacted_emails TO authenticated;

CREATE INDEX crm_prospects_email_normalized_idx ON public.crm_prospects(lower(btrim(email)));
CREATE INDEX crm_prospects_public_email_normalized_idx ON public.crm_prospects(lower(btrim(public_email)));
CREATE INDEX crm_mail_attempts_recipient_normalized_idx ON public.crm_mail_attempts(lower(btrim(recipient)));
CREATE INDEX crm_mail_history_outbound_address_idx ON public.crm_mail_history(lower(btrim(correspondent))) WHERE direction='outbound';

-- Historical contacted statuses are conservative evidence; do not lose them
-- if the prospect is later edited. Failed/unknown attempts block a repeat
-- but do not themselves mark a prospect contacted.
INSERT INTO public.crm_contacted_emails(email,first_contacted_at)
 SELECT lower(btrim(correspondent)),min(occurred_at)
 FROM public.crm_mail_history WHERE direction='outbound' AND delivery_status='delivered' AND nullif(btrim(correspondent),'') IS NOT NULL GROUP BY 1
 ON CONFLICT DO NOTHING;
INSERT INTO public.crm_contacted_emails(email,first_contacted_at)
 SELECT lower(btrim(a)),min(p.updated_at) FROM public.crm_prospects p
 CROSS JOIN LATERAL unnest(ARRAY[p.email,p.public_email]) AS t(a)
 WHERE p.status IN ('contacted','interested','trial','converted') AND nullif(btrim(a),'') IS NOT NULL GROUP BY 1
 ON CONFLICT DO NOTHING;

CREATE FUNCTION public.crm_email_blocked_for_first_contact(address text) RETURNS boolean
 LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 SELECT nullif(lower(btrim(address)),'') IS NULL
 OR EXISTS(SELECT 1 FROM public.crm_contacted_emails e WHERE e.email=lower(btrim(address)))
 OR EXISTS(SELECT 1 FROM public.crm_email_exclusions e WHERE lower(btrim(e.email))=lower(btrim(address)))
 OR EXISTS(SELECT 1 FROM public.crm_mail_attempts a WHERE lower(btrim(a.recipient))=lower(btrim(address)))
 OR EXISTS(SELECT 1 FROM public.crm_mail_history h WHERE h.direction='outbound' AND lower(btrim(h.correspondent))=lower(btrim(address)))
 OR EXISTS(SELECT 1 FROM public.crm_prospects p WHERE p.status IN ('contacted','interested','trial','converted','discarded','do_not_contact')
   AND (lower(btrim(p.email))=lower(btrim(address)) OR lower(btrim(p.public_email))=lower(btrim(address))));
 $$;

CREATE FUNCTION public.crm_record_contacted_email(address text) RETURNS void
 LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
 DECLARE normalized text:=lower(btrim(address));
 BEGIN
  IF normalized IS NULL OR normalized='' THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('crm-sendcorex-send'));
  INSERT INTO public.crm_contacted_emails(email) VALUES(normalized) ON CONFLICT DO NOTHING;
  UPDATE public.crm_prospects SET status='contacted',updated_at=now()
   WHERE status IN ('pending_review','qualified')
   AND (lower(btrim(email))=normalized OR lower(btrim(public_email))=normalized);
 END;
 $$;
REVOKE ALL ON FUNCTION public.crm_email_blocked_for_first_contact(text),public.crm_record_contacted_email(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_email_blocked_for_first_contact(text),public.crm_record_contacted_email(text) TO authenticated;

-- Every import/edit inherits confirmed contact history, without downgrading
-- interested, trial, converted, discarded or excluded businesses.
CREATE FUNCTION public.crm_inherit_contacted_email() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
 BEGIN
  IF NEW.status IN ('pending_review','qualified') AND EXISTS(
   SELECT 1 FROM public.crm_contacted_emails e WHERE e.email IN(lower(btrim(NEW.email)),lower(btrim(NEW.public_email)))
  ) THEN NEW.status:='contacted'; NEW.updated_at:=now(); END IF;
  RETURN NEW;
 END;
 $$;
CREATE TRIGGER crm_inherit_contacted_email BEFORE INSERT OR UPDATE OF email,public_email,status ON public.crm_prospects
 FOR EACH ROW EXECUTE FUNCTION public.crm_inherit_contacted_email();
REVOKE ALL ON FUNCTION public.crm_inherit_contacted_email() FROM PUBLIC,anon;

-- Serialize directory address/status writes against reservations and confirmations.
CREATE FUNCTION public.crm_contact_address_write_lock() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
 BEGIN PERFORM pg_advisory_xact_lock(hashtext('crm-sendcorex-send')); RETURN NULL; END;
 $$;
CREATE TRIGGER crm_contact_address_write_lock BEFORE INSERT OR UPDATE OF email,public_email,status ON public.crm_prospects
 FOR EACH STATEMENT EXECUTE FUNCTION public.crm_contact_address_write_lock();
REVOKE ALL ON FUNCTION public.crm_contact_address_write_lock() FROM PUBLIC,anon;

CREATE FUNCTION public.crm_record_delivered_address() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
 BEGIN
  IF NEW.direction='outbound' AND NEW.delivery_status='delivered' THEN
   PERFORM public.crm_record_contacted_email(NEW.correspondent);
  END IF;
  RETURN NEW;
 END;
 $$;
CREATE TRIGGER crm_record_delivered_address AFTER INSERT OR UPDATE OF delivery_status ON public.crm_mail_history
 FOR EACH ROW EXECUTE FUNCTION public.crm_record_delivered_address();
REVOKE ALL ON FUNCTION public.crm_record_delivered_address() FROM PUBLIC,anon;
-- One-time reconciliation of every existing duplicate.
UPDATE public.crm_prospects p SET status='contacted',updated_at=now()
 WHERE p.status IN ('pending_review','qualified') AND EXISTS(
 SELECT 1 FROM public.crm_contacted_emails e WHERE e.email IN(lower(btrim(p.email)),lower(btrim(p.public_email))));
