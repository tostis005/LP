# LP — Loyally

Plataforma de fidelización SaaS multiempresa, alojada en tu propio servidor
con Next.js 15, PostgreSQL 17 local y Docker. No requiere Supabase.

Incluye landing comercial, tarjetas QR, programas de sellos, puntos y
cashback; paneles de negocio, empleado, cliente y superadministración;
invitaciones, directorio geográfico, estadísticas, reversión auditable
de operaciones, activos de negocio y facturación Stripe opcional.

La base de datos utiliza funciones PostgreSQL transaccionales y políticas
RLS por negocio. La API de Next.js emplea dos roles de conexión sin
privilegios de superusuario, y la autenticación utiliza sesiones HttpOnly
y contraseñas scrypt, con verificación y recuperación mediante SMTP.

La carpeta supabase/migrations conserva el modelo SQL original, que el
migrador combina con un bootstrap nativo para auth y storage, pero no
despliega ni se conecta al servicio Supabase.

## Despliegue

Lee docs/DEPLOY_POSTGRES.md para los pasos de Contabo, migraciones, Caddy,
configuración SMTP, credenciales del primer administrador, copias de
seguridad y verificación de salud del servicio.

## Pendiente antes del lanzamiento comercial

Configurar SMTP, validar HTTPS sobre la IP, comprobar tests e integración,
configurar Stripe si se van a cobrar suscripciones y planificar backups
externos. Google/Apple OAuth y el envío masivo de campañas no están
implementados; el mailing solo guarda borradores.
