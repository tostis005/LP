-- Rename only the existing internal validation accounts, never create or
-- elevate an account based on an email address supplied by a public visitor.
CREATE TABLE IF NOT EXISTS auth.qa_profile_accounts (
 role text PRIMARY KEY CHECK(role IN ('ADMIN','BUSINESS','STAFF','CUSTOMER')),
 user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE
);
REVOKE ALL ON auth.qa_profile_accounts FROM PUBLIC,anon,authenticated,lp_api;
GRANT SELECT ON auth.qa_profile_accounts TO lp_auth;

DO $$
DECLARE
 item record;
 existing_id uuid;
BEGIN
 FOR item IN SELECT * FROM (VALUES
 ('ADMIN','admin@loyally.local','administrador@kreyviapp.com'),
 ('BUSINESS','gestor@loyally.local','owner@kreyviapp.com'),
 ('STAFF','empleado@loyally.local','empleado@kreyviapp.com'),
 ('CUSTOMER','cliente@loyally.local','cliente@kreyviapp.com')
 ) AS mapping(role,old_email,new_email)
 LOOP
  SELECT id INTO existing_id FROM auth.users
   WHERE lower(email)=item.old_email AND email_confirmed_at IS NOT NULL
   FOR UPDATE;
  IF existing_id IS NULL THEN
   -- Clean CI/sandbox installations do not yet contain showcase users.
   CONTINUE;
  END IF;
  IF EXISTS(SELECT 1 FROM auth.users WHERE lower(email)=item.new_email AND id<>existing_id) THEN
   RAISE EXCEPTION 'El correo de validación % ya pertenece a otra cuenta; no se aplica la migración.',item.new_email;
  END IF;
  INSERT INTO auth.qa_profile_accounts(role,user_id) VALUES(item.role,existing_id);
  UPDATE auth.users SET email=item.new_email,updated_at=now() WHERE id=existing_id;
  -- Old-address password-reset and verification links must no longer work.
  DELETE FROM auth.email_tokens WHERE user_id=existing_id;
 END LOOP;
END $$;
