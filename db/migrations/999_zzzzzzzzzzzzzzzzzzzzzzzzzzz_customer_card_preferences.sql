-- Display preferences never change the loyalty account or its balance.
ALTER TABLE public.loyalty_memberships ADD COLUMN IF NOT EXISTS customer_favorite boolean NOT NULL DEFAULT false;
ALTER TABLE public.loyalty_memberships ADD COLUMN IF NOT EXISTS customer_hidden boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.customer_set_card_display(p_membership uuid,p_favorite boolean,p_hidden boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR (p_favorite IS NULL AND p_hidden IS NULL) THEN RAISE EXCEPTION 'Preferencia no válida'; END IF;
 UPDATE public.loyalty_memberships SET customer_favorite=coalesce(p_favorite,customer_favorite),customer_hidden=coalesce(p_hidden,customer_hidden)
 WHERE id=p_membership AND customer_id=auth.uid() RETURNING id INTO v_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tarjeta no disponible'; END IF;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.customer_set_card_display(uuid,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.customer_set_card_display(uuid,boolean,boolean) TO authenticated;
