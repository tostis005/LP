-- Use the requested permanent brand domain for the existing QA accounts.
-- The previous migration may already have been applied in production.
DO $$
DECLARE
 item record;
 existing_id uuid;
BEGIN
 FOR item IN SELECT * FROM (VALUES
 ('ADMIN','administrador@kreyvi.com'),
 ('BUSINESS','owner@kreyvi.com'),
 ('STAFF','empleado@kreyvi.com'),
 ('CUSTOMER','cliente@kreyvi.com')
 ) AS mapping(role,new_email)
 LOOP
  SELECT u.id INTO existing_id
   FROM auth.qa_profile_accounts q JOIN auth.users u ON u.id=q.user_id
   WHERE q.role=item.role FOR UPDATE OF u;
  IF existing_id IS NULL THEN CONTINUE; END IF;
  IF EXISTS(SELECT 1 FROM auth.users WHERE lower(email)=item.new_email AND id<>existing_id) THEN
   RAISE EXCEPTION 'El correo de validación % ya pertenece a otra cuenta.',item.new_email;
  END IF;
  UPDATE auth.users SET email=item.new_email,updated_at=now() WHERE id=existing_id;
  DELETE FROM auth.email_tokens WHERE user_id=existing_id;
 END LOOP;
END $$;
