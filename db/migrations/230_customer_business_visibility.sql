-- Un cliente debe poder consultar los negocios de sus propias tarjetas,
-- también si no aparecen en el directorio público.
-- En la política anterior, "id" dentro de EXISTS se resolvía como m.id
-- (la tarjeta) en vez de businesses.id (el negocio).
DROP POLICY IF EXISTS businesses_read ON public.businesses;
CREATE POLICY businesses_read ON public.businesses FOR SELECT TO authenticated
USING (
 (active AND public_listing)
 OR public.is_business_staff(businesses.id)
 OR (SELECT public.is_platform_admin())
 OR EXISTS (
  SELECT 1 FROM public.loyalty_memberships m
  WHERE m.business_id=businesses.id AND m.customer_id=auth.uid()
 )
);
