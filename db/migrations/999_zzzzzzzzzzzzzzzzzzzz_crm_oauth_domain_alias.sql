-- Preserve existing grants without broadening the trusted CRM resource to arbitrary hosts.
-- The application validates the exact active audience on both issuance and token use.
ALTER TABLE auth.crm_research_grants
 DROP CONSTRAINT crm_research_grants_resource_check,
 ADD CONSTRAINT crm_research_grants_resource_check
 CHECK (resource IN ('https://kreyvi.com/api/mcp/crm','https://kreyviapp.com/api/mcp/crm'));
