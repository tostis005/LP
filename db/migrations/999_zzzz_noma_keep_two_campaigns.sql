-- One-time cleanup of the internal demo only. Never delete delivery or billing history.
-- Each offer is one campaign, even if sent via multiple channels.
DO $$
DECLARE v_business uuid; v_count integer; v_archived integer; v_hidden integer; v_keep text;
BEGIN
 SELECT id INTO v_business FROM public.businesses
 WHERE slug='interno-cafe-noma' AND name='Café Noma';
 IF v_business IS NULL THEN
  RAISE NOTICE 'Café Noma interno: no existe, sin cambios';
  RETURN;
 END IF;
 CREATE TEMP TABLE noma_campaign_cleanup_candidates ON COMMIT DROP AS
 SELECT q.*,row_number() OVER(ORDER BY q.created_at DESC,q.id DESC,q.kind) AS position
 FROM (
  SELECT o.id,'offer'::text AS kind,o.created_at,o.title
  FROM public.business_offers o
  WHERE o.business_id=v_business AND o.archived_at IS NULL
  AND NOT EXISTS(SELECT 1 FROM public.automation_rules a WHERE a.offer_id=o.id)
  UNION ALL
  SELECT c.id,'marketing'::text,c.created_at,c.subject
  FROM public.marketing_campaigns c
  WHERE c.business_id=v_business AND c.offer_id IS NULL
  AND NOT EXISTS(SELECT 1 FROM public.demo_hidden_campaigns h WHERE h.business_id=v_business AND h.campaign_id=c.id)
  UNION ALL
  SELECT p.id,'push'::text,p.created_at,p.title
  FROM public.push_campaigns p
  WHERE p.business_id=v_business
  AND NOT EXISTS(SELECT 1 FROM public.business_offers o WHERE o.push_campaign_id=p.id)
  AND NOT EXISTS(SELECT 1 FROM public.demo_hidden_campaigns h WHERE h.business_id=v_business AND h.campaign_id=p.id)
 ) q;
 SELECT count(*) INTO v_count FROM noma_campaign_cleanup_candidates;
 SELECT string_agg(kind||':'||id::text,', ' ORDER BY position) INTO v_keep
 FROM noma_campaign_cleanup_candidates WHERE position<=2;
 -- Do not change a campaign with live delivery work in progress. A later cleanup
 -- can be requested after it has finished, without interfering with delivery.
 IF EXISTS(
  SELECT 1 FROM noma_campaign_cleanup_candidates n
  WHERE n.position>2 AND (
   EXISTS(SELECT 1 FROM public.marketing_campaigns c
    WHERE c.business_id=v_business AND c.status IN ('queued','sending')
    AND ((n.kind='marketing' AND c.id=n.id) OR (n.kind='offer' AND c.offer_id=n.id)))
   OR EXISTS(SELECT 1 FROM public.push_campaigns p
    WHERE p.business_id=v_business AND p.status IN ('queued','sending')
    AND ((n.kind='push' AND p.id=n.id) OR (n.kind='offer' AND EXISTS(
      SELECT 1 FROM public.business_offers o WHERE o.id=n.id AND o.push_campaign_id=p.id))))
  )
 ) THEN
  RAISE NOTICE 'Café Noma: limpieza omitida por envíos antiguos en curso';
  RETURN;
 END IF;
 UPDATE public.business_offers o SET archived_at=now()
 FROM noma_campaign_cleanup_candidates n
 WHERE n.position>2 AND n.kind='offer' AND n.id=o.id AND o.business_id=v_business
 AND o.archived_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM public.automation_rules a WHERE a.offer_id=o.id);
 GET DIAGNOSTICS v_archived=ROW_COUNT;
 INSERT INTO public.demo_hidden_campaigns(business_id,campaign_id)
 SELECT v_business,n.id FROM noma_campaign_cleanup_candidates n
 WHERE n.position>2 AND n.kind IN ('marketing','push')
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS v_hidden=ROW_COUNT;
 RAISE NOTICE 'Café Noma: visibles antes %, archivadas %, ocultas %, conservadas % (%).',v_count,v_archived,v_hidden,least(2,v_count),coalesce(v_keep,'ninguna');
END $$;
