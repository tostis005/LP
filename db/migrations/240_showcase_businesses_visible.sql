-- Durante la validación de producto: publicar EXCLUSIVAMENTE los diez
-- establecimientos de muestra existentes (no todos los negocios reales).
-- El propietario podrá volver a desmarcar «Aparecer en el directorio»
-- cuando se terminen las pruebas. No se modifican usuarios, tarjetas ni saldos.
UPDATE public.businesses
SET public_listing=true
WHERE slug IN (
 'interno-cafe-noma','interno-brunch-club','interno-barba-norte',
 'interno-studio-verde','interno-taco-lumbre','interno-pan-mar',
 'interno-dulce-frontera','interno-punto-fit','interno-lavanda-spa',
 'interno-marea-pets'
) AND active=true;

UPDATE public.business_locations AS l
SET visible=true
FROM public.businesses AS b
WHERE l.business_id=b.id AND b.active=true AND b.public_listing=true
 AND b.slug IN (
 'interno-cafe-noma','interno-brunch-club','interno-barba-norte',
 'interno-studio-verde','interno-taco-lumbre','interno-pan-mar',
 'interno-dulce-frontera','interno-punto-fit','interno-lavanda-spa',
 'interno-marea-pets'
 );
