-- Moneda por establecimiento y recompensas sin valoración obligatoria.
-- Los importes históricos no se convierten automáticamente al cambiar la moneda.
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'MXN';
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_currency_check;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_currency_check CHECK (currency IN ('MXN','USD','EUR'));
UPDATE public.businesses b SET currency=r.currency
FROM public.business_marketing_rates r
WHERE r.business_id=b.id AND r.currency IN ('MXN','USD','EUR') AND b.currency='MXN';

ALTER TABLE public.reward_options ALTER COLUMN retail_cents DROP NOT NULL;
ALTER TABLE public.reward_options ALTER COLUMN cost_cents DROP NOT NULL;

-- La moneda es una configuración comercial; nunca debe cambiarse desde el área del dueño.
-- No reinterpretar ventas y saldos registrados con una moneda distinta.
CREATE OR REPLACE FUNCTION public.guard_business_currency()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.currency IS DISTINCT FROM OLD.currency THEN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Solo administración puede cambiar la moneda'; END IF;
  IF EXISTS(SELECT 1 FROM public.loyalty_transactions t WHERE t.business_id=OLD.id AND t.purchase_cents IS NOT NULL)
   OR EXISTS(SELECT 1 FROM public.reward_redemptions r WHERE r.business_id=OLD.id AND (r.retail_cents IS NOT NULL OR r.cost_cents IS NOT NULL))
   OR EXISTS(SELECT 1 FROM public.marketing_usage_ledger l WHERE l.business_id=OLD.id)
   OR EXISTS(SELECT 1 FROM public.push_usage_ledger l WHERE l.business_id=OLD.id)
  THEN RAISE EXCEPTION 'La moneda no puede cambiarse con importes históricos; consulta con administración para una migración'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_business_currency ON public.businesses;
CREATE TRIGGER guard_business_currency BEFORE UPDATE OF currency ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.guard_business_currency();
