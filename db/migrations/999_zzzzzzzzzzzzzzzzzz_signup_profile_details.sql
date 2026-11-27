-- Persist validated signup details once the email owner has confirmed the account.
-- Older accounts, OAuth and staff invitations are unaffected.
CREATE OR REPLACE FUNCTION public.confirm_initial_signup_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL
    AND NEW.raw_user_meta_data->>'birth_date' IS NOT NULL THEN
  UPDATE public.profiles SET
   birth_date=(NEW.raw_user_meta_data->>'birth_date')::date,
   gender=NEW.raw_user_meta_data->>'gender'
  WHERE id=NEW.id AND birth_date IS NULL;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.confirm_initial_signup_profile() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS zzz_confirm_initial_signup_profile ON auth.users;
CREATE TRIGGER zzz_confirm_initial_signup_profile AFTER UPDATE OF email_confirmed_at ON auth.users
 FOR EACH ROW EXECUTE FUNCTION public.confirm_initial_signup_profile();
