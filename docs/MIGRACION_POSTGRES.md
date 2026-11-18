# Migración de LP de Supabase a PostgreSQL nativo

Código migrado en la rama infra/postgresql-docker:
- Cliente local compatible con los antiguos métodos from/rpc/auth/storage.
- API Next.js con roles PostgreSQL limitados y RLS por sesión verificada.
- Esquemas nativos auth y storage con migración automática 000-010.
- Usuarios propios (hash scrypt), sesiones HttpOnly, verificación SMTP.
- Ficheros en volumen Docker, imágenes validadas.
- Facturación Stripe por webhook firmado, con estado transaccional.

No se despliega Supabase y el navegador nunca recibe credenciales de
PostgreSQL. Los archivos originales SQL se guardan bajo supabase/migrations
para conservar funciones y políticas existentes.

Antes de declarar listo para producción:
1. Ejecutar los workflows de CI y el build Docker en Contabo.
2. Comprobar las funciones con usuarios reales y SMTP configurado.
3. Verificar certificado HTTPS de la IP, copias de seguridad y restauración.
4. Probar pagos Stripe y webhook antes de activar cobro obligatorio.
5. Añadir credenciales OAuth si se requiere login social.
6. Integrar proveedor y controles de envío si se desean campañas masivas.
