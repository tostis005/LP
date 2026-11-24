-- Rename user-facing messages without changing permissions or business logic.
DO $$
DECLARE
  signature regprocedure;
  definition text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.manager_create_branch(uuid,text,text,text)'::regprocedure,
    'public.limit_business_registration_changes()'::regprocedure,
    'public.limit_business_location_changes()'::regprocedure,
    'public.admin_set_business_location(uuid,text,text,text,text,double precision,double precision)'::regprocedure,
    'public.admin_set_business_contract(uuid,integer)'::regprocedure
  ] LOOP
    definition := pg_get_functiondef(signature);
    IF position('Loyally' IN definition) > 0 THEN
      EXECUTE replace(definition, 'Loyally', 'KREYVI');
    END IF;
  END LOOP;
END $$;
