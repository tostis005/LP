-- Reparación puntual del fondo retirado accidentalmente de Café Noma.
-- No sustituye un fondo que ya haya sido restaurado manualmente.
UPDATE public.businesses AS b
SET card_background = (
  SELECT 'https://kreyvi.com/api/assets/business-assets/' || o.name
  FROM storage.objects AS o
  WHERE o.bucket_id = 'business-assets'
    AND split_part(o.name, '/', 1) = b.id::text
    AND split_part(o.name, '/', 2) ~ '^cardbg-[0-9]+-[a-z0-9._-]+\.(webp|png|jpg|jpeg)$'
    AND o.name NOT LIKE '%..%'
    AND array_length(string_to_array(o.name, '/'), 1) = 2
  ORDER BY o.created_at DESC, o.name DESC
  LIMIT 1
)
WHERE b.slug = 'interno-cafe-noma'
  AND b.name = 'Café Noma'
  AND NULLIF(b.card_background, '') IS NULL
  AND EXISTS (
    SELECT 1 FROM storage.objects AS o
    WHERE o.bucket_id = 'business-assets'
      AND split_part(o.name, '/', 1) = b.id::text
      AND split_part(o.name, '/', 2) ~ '^cardbg-[0-9]+-[a-z0-9._-]+\.(webp|png|jpg|jpeg)$'
      AND o.name NOT LIKE '%..%'
      AND array_length(string_to_array(o.name, '/'), 1) = 2
  );
