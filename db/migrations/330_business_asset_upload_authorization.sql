-- Las imágenes de campañas y los logos del negocio comparten una comprobación
-- explícita de propiedad. Evita depender de privilegios de la tabla storage.objects
-- en la sesión de usuario (los bytes siguen en el volumen privado de la aplicación).
CREATE OR REPLACE FUNCTION public.register_business_asset(p_business uuid,p_filename text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 v_path text;
BEGIN
 IF p_business IS NULL OR NOT public.is_business_manager(p_business) THEN
  RAISE EXCEPTION 'No tienes permiso para subir imágenes de este negocio';
 END IF;
 IF p_filename IS NULL
    OR p_filename !~ '^[a-z0-9][a-z0-9._-]{0,140}$'
    OR position('..' in p_filename)>0
    OR p_filename !~* '\.(png|jpe?g|webp)$'
 THEN RAISE EXCEPTION 'Nombre de imagen no válido'; END IF;
 v_path:=p_business::text || '/' || p_filename;
 INSERT INTO storage.objects(bucket_id,name) VALUES('business-assets',v_path);
 RETURN v_path;
END $$;
REVOKE ALL ON FUNCTION public.register_business_asset(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.register_business_asset(uuid,text) TO authenticated;
