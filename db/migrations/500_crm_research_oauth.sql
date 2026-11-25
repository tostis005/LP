-- Short-lived, separately revocable OAuth grants for the CRM research connector.
-- No access to the normal browser session is exposed by this integration.
CREATE TABLE auth.crm_research_grants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 client_id text NOT NULL CHECK (client_id='kreyvi-crm-chatgpt'),
 redirect_uri text NOT NULL CHECK (redirect_uri='https://chatgpt.com/connector_platform_oauth_redirect'),
 resource text NOT NULL CHECK (resource='https://kreyvi.com/api/mcp/crm'),
 scope text NOT NULL CHECK (scope='crm:research'),
 code_hash text NOT NULL UNIQUE CHECK (code_hash ~ '^[a-f0-9]{64}$'),
 code_challenge text NOT NULL CHECK (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
 code_expires_at timestamptz NOT NULL,
 code_used_at timestamptz,
 token_hash text UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
 token_expires_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_research_grants_user_idx ON auth.crm_research_grants(user_id);
REVOKE ALL ON auth.crm_research_grants FROM PUBLIC,anon,authenticated,lp_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON auth.crm_research_grants TO lp_auth;
