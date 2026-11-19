-- OAuth externo: identidades vinculadas a usuarios locales con RLS y sesiones propias.
-- Nunca se guardan tokens de Google/Apple; solo el sujeto verificado por su ID token.
CREATE TABLE IF NOT EXISTS auth.oauth_identities (
  provider text NOT NULL CHECK(provider IN ('google','apple')),
  subject text NOT NULL CHECK(length(subject) BETWEEN 1 AND 255),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sign_in_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(provider,subject),
  UNIQUE(user_id,provider)
);
CREATE INDEX IF NOT EXISTS oauth_identities_user_idx ON auth.oauth_identities(user_id);

-- Código de autorización de uso único; la cookie HTTP-only se valida en callback.
CREATE TABLE IF NOT EXISTS auth.oauth_attempts (
  state_hash text PRIMARY KEY CHECK(length(state_hash)=64),
  provider text NOT NULL CHECK(provider IN ('google','apple')),
  nonce text NOT NULL,
  code_verifier text NOT NULL,
  return_to text NOT NULL CHECK(return_to IN ('/mi-loyally','/app','/entrar')),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oauth_attempts_expiry_idx ON auth.oauth_attempts(expires_at);
