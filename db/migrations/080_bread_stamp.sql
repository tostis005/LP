-- El pan es una ilustración diferenciada del croissant para panaderías.
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_stamp_icon_check;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_stamp_icon_check CHECK (
 stamp_icon IN ('coffee','burger','beard','hair','pizza','bread','croissant','icecream','flower','scissors',
 'star','heart','gift','taco','donut','gym','spa','pet','nails','book','car','bicycle','juice')
);
