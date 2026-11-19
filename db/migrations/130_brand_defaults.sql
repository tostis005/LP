-- Identidad por defecto para NUEVOS negocios. No se altera ninguna tarjeta personalizada existente.
ALTER TABLE public.businesses
  ALTER COLUMN accent_color SET DEFAULT '#571c32',
  ALTER COLUMN stamp_color SET DEFAULT '#571c32';
