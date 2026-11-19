-- Ficha pública de un negocio y su programa, visible incluso antes de registrarse.
-- Solo devuelve información comercial; jamás correos, clientes ni preferencias.
CREATE OR REPLACE FUNCTION public.public_business_details(p_slug text)
RETURNS TABLE(
 business_id uuid,business_name text,description text,accent_color text,category text,
 logo_url text,card_text text,card_text_color text,stamp_color text,stamp_icon text,
 reward_label text,program_type text,reward_cost integer,cashback_bps integer,
 points_per_euro integer,public_listing boolean,locations_json jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT b.id,b.name,b.description,b.accent_color,b.category,
  b.logo_url,b.card_text,b.card_text_color,b.stamp_color,b.stamp_icon,
  p.reward_label,p.type,p.reward_cost,p.cashback_bps,p.points_per_euro,b.public_listing,
  CASE WHEN b.public_listing THEN
   COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id',l.id,'business_id',l.business_id,'name',l.name,'address',l.address,
    'city',l.city,'country',l.country,'lat',l.lat,'lng',l.lng
   ) ORDER BY l.name)
   FROM public.business_locations l WHERE l.business_id=b.id AND l.visible),'[]'::jsonb)
  ELSE '[]'::jsonb END
 FROM public.businesses b JOIN public.loyalty_programs p ON p.business_id=b.id
 WHERE b.slug=p_slug AND b.active
 LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.public_business_details(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_business_details(text) TO anon,authenticated;
