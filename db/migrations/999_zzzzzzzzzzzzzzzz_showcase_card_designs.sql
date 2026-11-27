-- Personalize the nine known internal showcase merchants, never real merchant accounts.
-- Café Noma and every existing custom background are deliberately untouched.
CREATE FUNCTION public.apply_internal_showcase_card_designs() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE changed integer;
BEGIN
 UPDATE public.businesses b SET card_background=d.background, accent_color=d.color,
 card_text_color='#ffffff', stamp_color=d.color
 FROM (VALUES
 ('interno-brunch-club','Brunch Club','#493122','/brand/card-designs/showcase-brunch-club.svg'),
 ('interno-barba-norte','Barba Norte','#202e42','/brand/card-designs/showcase-barba-norte.svg'),
 ('interno-studio-verde','Studio Verde','#193b31','/brand/card-designs/showcase-studio-verde.svg'),
 ('interno-taco-lumbre','Taco Lumbre','#592317','/brand/card-designs/showcase-taco-lumbre.svg'),
 ('interno-pan-mar','Pan Mar','#493529','/brand/card-designs/showcase-pan-mar.svg'),
 ('interno-dulce-frontera','Dulce Frontera','#643552','/brand/card-designs/showcase-dulce-frontera.svg'),
 ('interno-punto-fit','Punto Fit','#172e4a','/brand/card-designs/showcase-punto-fit.svg'),
 ('interno-lavanda-spa','Lavanda Spa','#392c55','/brand/card-designs/showcase-lavanda-spa.svg'),
 ('interno-marea-pets','Marea Pets','#184747','/brand/card-designs/showcase-marea-pets.svg')
 ) AS d(slug,name,color,background)
 WHERE b.slug=d.slug AND b.name=d.name
 AND NULLIF(btrim(b.card_background),'') IS NULL;
 GET DIAGNOSTICS changed=ROW_COUNT;
 RETURN changed;
END $$;
REVOKE ALL ON FUNCTION public.apply_internal_showcase_card_designs() FROM PUBLIC,anon,authenticated,lp_api,lp_auth;
SELECT public.apply_internal_showcase_card_designs();
