-- Update only known internal fixtures still using their initial showcase artwork.
-- Keep Café Noma, all real businesses, and independently uploaded/selected designs intact.
CREATE OR REPLACE FUNCTION public.apply_internal_showcase_card_designs() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE changed integer;
BEGIN
 UPDATE public.businesses b SET
 card_background='/brand/card-designs/gallery-vivid-'||d.slug||'.svg',
 accent_color=d.color, card_text_color=d.text_color, stamp_color=d.stamp_color,
 card_title_font=CASE WHEN b.card_title_font='default' THEN d.font ELSE b.card_title_font END
 FROM (VALUES
 ('brunch-club','Brunch Club','#ffdb58','#3d2b22','#ba482a','rounded'),
 ('barba-norte','Barba Norte','#122d52','#ffffff','#1c527d','display'),
 ('studio-verde','Studio Verde','#e8f4b1','#214d40','#337a58','editorial'),
 ('taco-lumbre','Taco Lumbre','#c42d46','#ffffff','#a6213e','display'),
 ('pan-mar','Pan Mar','#fff0ca','#64351e','#aa5e2c','editorial'),
 ('dulce-frontera','Dulce Frontera','#f9b4d7','#562258','#ad387d','rounded'),
 ('punto-fit','Punto Fit','#19205e','#ffffff','#3545a6','display'),
 ('lavanda-spa','Lavanda Spa','#e6d9ff','#493063','#7954a0','editorial'),
 ('marea-pets','Marea Pets','#a9e8df','#214b58','#266d80','rounded')
 ) AS d(slug,name,color,text_color,stamp_color,font)
 WHERE b.slug='interno-'||d.slug AND b.name=d.name
 AND (NULLIF(btrim(b.card_background),'') IS NULL
      OR b.card_background='/brand/card-designs/showcase-'||d.slug||'.svg');
 GET DIAGNOSTICS changed=ROW_COUNT;
 RETURN changed;
END $$;
REVOKE ALL ON FUNCTION public.apply_internal_showcase_card_designs() FROM PUBLIC,anon,authenticated,lp_api,lp_auth;
SELECT public.apply_internal_showcase_card_designs();
