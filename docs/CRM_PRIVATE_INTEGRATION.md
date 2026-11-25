# Integración privada del CRM de KREYVI

Estado: servidor MCP y autorización implementados en rama de desarrollo. No conectar hasta completar las pruebas y comprobar el despliegue.

## API de sesión
`GET /api/local/admin/crm/research` devuelve estadísticas de Tecate y hasta 25 establecimientos pendientes. `POST` registra hasta 25 revisiones por ID DENUE, sin modificar los datos originales y sin enviar correo. Ambas requieren sesión de administrador; la escritura exige origen permitido.

## Servidor MCP privado
Endpoint: `https://kreyvi.com/api/mcp/crm` (Streamable HTTP, respuestas JSON sin sesiones de transporte).
Herramientas: `tecate_pending_businesses` y `tecate_record_contact_review`.
Alcance exclusivo: restaurantes, cafeterías y heladerías del municipio 02003, con registro existente en DENUE. No crea registros sin identidad, envía mensajes ni accede a otros módulos. No registra datos en GitHub.

## OAuth
Cliente público preconfigurado: `kreyvi-crm-chatgpt`. Autenticación del cliente: none (PKCE S256 obligatorio).
Issuer: `https://kreyvi.com`.
Callback único: `https://chatgpt.com/connector_platform_oauth_redirect`.
Recurso: URL del servidor MCP. Scope único: `crm:research`.
Metadatos: `/.well-known/oauth-authorization-server` y `/.well-known/oauth-protected-resource/api/mcp/crm`.
La autorización requiere sesión confirmada de administrador y consentimiento explícito; los códigos caducan en 5 minutos y son de un solo uso. Los tokens opacos se almacenan como hash, caducan en una hora y se revocan desde CRM > Conexión privada con ChatGPT. No hay refresh tokens en esta primera versión. Se vuelve a verificar el rol en cada operación.

Tras verificar el endpoint de producción, añadir el servidor MCP privado desde ChatGPT Plugins usando OAuth con cliente predefinido y la configuración anterior. Comprobar que el cliente admite el callback estable y el método público none. Si requiere otra modalidad, adaptar la implementación antes de conectar. No habilitar el acceso anónimo ni compartir contraseñas o tokens en el chat.

## Validación
La prueba `tests/native/crm-connector.mjs` utiliza solo la base lp_test, con datos sintéticos. Comprueba PKCE, código de un solo uso, hash, acceso anónimo, pérdida del rol, expiración, revocación, exclusiones, conservación del correo original y aislamiento geográfico. Falta validar el transporte MCP, el consentimiento en navegador y la conexión de extremo a extremo con el cliente real.
