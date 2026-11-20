-- Enlaces privados, de un solo uso, para autorizar pruebas de perfiles reales.
-- Ninguna contraseña de cuenta se publica ni se envía al navegador.
CREATE TABLE IF NOT EXISTS auth.qa_access_links(
 token_hash text PRIMARY KEY,
 role text NOT NULL CHECK (role IN ('ADMIN','BUSINESS','STAFF','CUSTOMER')),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qa_access_links_expires_idx ON auth.qa_access_links(expires_at);
