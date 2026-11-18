-- Diseño visual de sellos por negocio. Los SVG prediseñados se renderizan desde el código.
-- Las imágenes subidas siguen la validación actual: PNG, JPG o WEBP, nunca SVG arbitrarios.
ALTER TABLE public.businesses
 ADD COLUMN IF NOT EXISTS stamp_icon text NOT NULL DEFAULT 'coffee',
 ADD COLUMN IF NOT EXISTS stamp_image_url text;
UPDATE public.businesses SET stamp_icon='coffee' WHERE stamp_icon IS NULL;
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_stamp_icon_check;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_stamp_icon_check
 CHECK (stamp_icon IN ('coffee','burger','beard','hair','pizza','croissant','icecream','flower','scissors','star','heart','gift','taco','donut'));
