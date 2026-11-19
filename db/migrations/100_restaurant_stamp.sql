-- La categoría de restaurante usa un icono genérico de plato y cubiertos.
-- Se mantiene la compatibilidad con las tarjetas anteriores.
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_stamp_icon_check;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_stamp_icon_check CHECK (
 stamp_icon IN ('coffee','burger','restaurant','beard','hair','pizza','bread','croissant',
 'icecream','flower','scissors','star','heart','gift','taco','donut','gym','spa',
 'pet','nails','book','car','bicycle','juice')
);
