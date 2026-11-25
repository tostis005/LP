-- One-time cleanup for the internal Café Noma demo, never for other merchants.
-- Preserve charged/sent records for accounting and keep automated offers intact.
ALTER TABLE public.business_offers ADD COLUMN IF NOT EXISTS archived_at timestamptz;
-- Standalone channel campaigns predate business_offers; retain their historical
-- delivery/charge records but remove them from the demo's campaign management.
CREATE TABLE IF NOT EXISTS public.demo_hidden_campaigns (
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 campaign_id uuid NOT NULL,
 PRIMARY KEY(business_id,campaign_id)
);
ALTER TABLE public.demo_hidden_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS demo_hidden_campaigns_manager_read ON public.demo_hidden_campaigns;
CREATE POLICY demo_hidden_campaigns_manager_read ON public.demo_hidden_campaigns FOR SELECT TO authenticated
 USING(public.is_business_manager(business_id) OR public.is_platform_admin());
GRANT SELECT ON public.demo_hidden_campaigns TO authenticated;
DO $$
DECLARE v_business uuid; v_keep public.business_offers%ROWTYPE; v_count integer;
BEGIN
 SELECT id INTO v_business FROM public.businesses
 WHERE slug='interno-cafe-noma' AND name='Café Noma';
 IF v_business IS NULL THEN RETURN; END IF;
 SELECT o.* INTO v_keep FROM public.business_offers o
 WHERE o.business_id=v_business AND o.archived_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM public.automation_rules a WHERE a.offer_id=o.id)
 ORDER BY o.created_at DESC,o.id DESC LIMIT 1;
 IF NOT FOUND OR coalesce(v_keep.image_url,'')='' OR
    lower(v_keep.title||' '||v_keep.preview||' '||v_keep.details) !~ 'caf[eé]' THEN
   RAISE NOTICE 'Demo campaigns unchanged: newest offer is not an identifiable coffee offer with image';
   RETURN;
 END IF;
 UPDATE public.business_offers o SET archived_at=now()
 WHERE o.business_id=v_business AND o.id<>v_keep.id
 AND o.archived_at IS NULL AND o.created_at<=v_keep.created_at
 AND NOT EXISTS(SELECT 1 FROM public.automation_rules a WHERE a.offer_id=o.id);
 GET DIAGNOSTICS v_count=ROW_COUNT;
 INSERT INTO public.demo_hidden_campaigns(business_id,campaign_id)
 SELECT v_business,c.id FROM public.marketing_campaigns c
 WHERE c.business_id=v_business AND c.offer_id IS NULL AND c.created_at<=v_keep.created_at
 UNION
 SELECT v_business,p.id FROM public.push_campaigns p
 WHERE p.business_id=v_business AND p.created_at<=v_keep.created_at
 AND NOT EXISTS(SELECT 1 FROM public.business_offers o WHERE o.push_campaign_id=p.id)
 ON CONFLICT DO NOTHING;
 RAISE NOTICE 'Café Noma: archived % earlier demo campaigns; retained offer %',v_count,v_keep.id;
END $$;

-- Public join cards need the same two design assets as authenticated cards.
CREATE OR REPLACE FUNCTION public.public_business_card_assets(p_slug text)
RETURNS TABLE(card_background text,stamp_image_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT b.card_background,b.stamp_image_url FROM public.businesses b
 JOIN public.loyalty_programs p ON p.business_id=b.id
 WHERE b.slug=p_slug AND b.active LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.public_business_card_assets(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_business_card_assets(text) TO anon,authenticated;
