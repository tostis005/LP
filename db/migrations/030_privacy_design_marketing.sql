-- Personalización segura, privacidad de contactos y presupuesto de marketing.
ALTER TABLE public.businesses
 ADD COLUMN IF NOT EXISTS card_text_color text NOT NULL DEFAULT '#ffffff',
 ADD COLUMN IF NOT EXISTS stamp_color text NOT NULL DEFAULT '#275642';
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_card_text_color_check;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_card_text_color_check CHECK(card_text_color ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_stamp_color_check;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_stamp_color_check CHECK(stamp_color ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_stamp_icon_check;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_stamp_icon_check CHECK (
 stamp_icon IN ('coffee','burger','beard','hair','pizza','croissant','icecream','flower','scissors',
                'star','heart','gift','taco','donut','gym','spa','pet','nails','book','car','bicycle','juice')
);

-- El comercio nunca recibe el correo completo del cliente desde este RPC.
-- El correo completo se queda en auth.users, protegido en el servidor.
CREATE OR REPLACE FUNCTION public.business_customer_directory(p_business uuid)
RETURNS TABLE(user_id uuid,full_name text,email text,balance integer,total_earned integer,visits bigint,marketing_ok boolean,joined_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT (public.is_business_manager(p_business) OR public.is_platform_admin()) THEN
  RAISE EXCEPTION 'No autorizado';
 END IF;
 RETURN QUERY
 SELECT m.customer_id,p.full_name,
   (left(split_part(u.email,'@',1),2)||'***@'||left(split_part(u.email,'@',2),1)||'***')::text,
   m.balance,m.total_earned,
   (SELECT count(*) FROM public.loyalty_transactions t WHERE t.membership_id=m.id AND t.kind='earn'),
   coalesce(c.opted_in,false),m.created_at
 FROM public.loyalty_memberships m JOIN public.profiles p ON p.id=m.customer_id
 JOIN auth.users u ON u.id=m.customer_id
 LEFT JOIN public.marketing_consents c ON c.customer_id=m.customer_id AND c.business_id=p_business
 WHERE m.business_id=p_business ORDER BY m.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.business_customer_directory(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_customer_directory(uuid) TO authenticated;

-- Los precios son propiedad de la plataforma, nunca editables por el negocio.
CREATE TABLE IF NOT EXISTS public.business_marketing_rates(
 business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
 price_cents integer NOT NULL DEFAULT 1 CHECK (price_cents BETWEEN 0 AND 100000),
 currency text NOT NULL DEFAULT 'MXN' CHECK (currency IN ('MXN','EUR','USD')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.business_marketing_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketing_rates_read ON public.business_marketing_rates;
CREATE POLICY marketing_rates_read ON public.business_marketing_rates FOR SELECT TO authenticated
 USING(public.is_business_manager(business_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS marketing_rates_admin_insert ON public.business_marketing_rates;
CREATE POLICY marketing_rates_admin_insert ON public.business_marketing_rates FOR INSERT TO authenticated
 WITH CHECK(public.is_platform_admin());
DROP POLICY IF EXISTS marketing_rates_admin_update ON public.business_marketing_rates;
CREATE POLICY marketing_rates_admin_update ON public.business_marketing_rates FOR UPDATE TO authenticated
 USING(public.is_platform_admin()) WITH CHECK(public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.business_mail_quote(p_business uuid)
RETURNS TABLE(contacts bigint,price_cents integer,total_cents bigint,currency text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT (public.is_business_manager(p_business) OR public.is_platform_admin()) THEN
  RAISE EXCEPTION 'No autorizado';
 END IF;
 RETURN QUERY
 SELECT count(DISTINCT m.customer_id),
        coalesce(r.price_cents,1),
        count(DISTINCT m.customer_id)*coalesce(r.price_cents,1),
        coalesce(r.currency,'MXN')::text
 FROM public.loyalty_memberships m
 JOIN auth.users u ON u.id=m.customer_id AND u.email_confirmed_at IS NOT NULL
 JOIN public.marketing_consents c ON c.business_id=m.business_id AND c.customer_id=m.customer_id AND c.opted_in
 LEFT JOIN public.business_marketing_rates r ON r.business_id=m.business_id
 WHERE m.business_id=p_business
 GROUP BY r.price_cents,r.currency;
 IF NOT FOUND THEN
  RETURN QUERY SELECT 0::bigint,coalesce(r.price_cents,1),0::bigint,coalesce(r.currency,'MXN')
  FROM (SELECT 1) x LEFT JOIN public.business_marketing_rates r ON r.business_id=p_business;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.business_mail_quote(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.business_mail_quote(uuid) TO authenticated;
