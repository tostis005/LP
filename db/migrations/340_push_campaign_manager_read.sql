-- El editor unificado consulta el estado de las campañas push al cargar.
-- La tabla estaba sin permisos de SELECT para authenticated, así que incluso
-- una consulta de historial vacía producía SQLSTATE 42501 antes de crear nada.
-- Solo exponemos las columnas que necesita el listado, nunca suscripciones,
-- destinatarios, claves push ni contenido privado de los dispositivos.
GRANT SELECT (id,business_id,status,recipient_count,sent_count,failed_count)
 ON public.push_campaigns TO authenticated;

DROP POLICY IF EXISTS push_campaign_manager_read ON public.push_campaigns;
CREATE POLICY push_campaign_manager_read ON public.push_campaigns
 FOR SELECT TO authenticated
 USING (public.is_business_manager(business_id) OR public.is_platform_admin());
