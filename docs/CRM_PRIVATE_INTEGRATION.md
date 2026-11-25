# Integración privada del CRM de KREYVI

Estado: API de revisión interna; no constituye todavía una conexión autorizada de ChatGPT.

## Alcance
`GET /api/local/admin/crm/research` devuelve estadísticas de Tecate y hasta 25 establecimientos del piloto pendientes, con identificador DENUE, nombre, localidad, actividad y web. Se pagina con `after`.
`POST /api/local/admin/crm/research` registra hasta 25 revisiones en una transacción. Exige sesión de administrador y origen autorizado. Cada revisión lleva `source_id`, `review`, `source_url` y `public_email` (nulo si no hay correo).
Solo se actualizan negocios existentes del piloto, nunca se elimina un contacto, se sobrescribe evidencia incompatible, se envían mensajes ni se modifica la información de clientes. Se respeta la lista de exclusiones. Los datos de contacto no deben incluirse en archivos de GitHub ni en logs.

## Conexión externa pendiente
El servidor actual usa sesiones de navegador y PostgreSQL privado. ChatGPT no tiene una sesión en KREYVI ni un canal SSH en este contexto. La API interna no acepta tokens de sesión por URL ni credenciales compartidas.
Antes de habilitar un conector externo, implementar y verificar una autorización revocable de alcance CRM (lectura de cola y registro de evidencia), usando un flujo OAuth compatible con el cliente MCP. La autorización debe exigir acceso de administrador y consentimiento explícito en KREYVI. No reutilizar la contraseña del VPS, abrir el puerto de PostgreSQL, usar una cuenta privilegiada ni guardar secretos en un repositorio o conversación.
El servidor MCP debe verificar alcance, expiración y revocación, registrar auditoría sin datos de contacto, y llamar al servicio de revisión con identidad autorizada. No habilitar envío de correo ni acceso a otros perfiles. No conectar un plugin hasta verificar el endpoint real y su autenticación.
## Pruebas necesarias
Verificar acceso anónimo 401, usuario sin rol 403, origen no permitido 403, lote repetido y fuera de ámbito rechazado, preservación de datos de origen y exclusiones, resultados de revisión persistidos y contadores correctos. Las pruebas de extremo a extremo deben ejecutarse sobre un entorno de prueba, no con datos de producción.
