# LP: configuración propia con PostgreSQL

LP funciona sobre PostgreSQL 17 en Docker sin servicios Supabase.

## Instalación en Contabo
La guía detallada y el flujo de despliegue están en [DEPLOY_POSTGRES.md](DEPLOY_POSTGRES.md).
Resumen: configura `.env.production`, ejecuta migraciones, inicia Docker,
verifica `/api/health` y configura el Caddy existente.

## Credenciales
`POSTGRES_PASSWORD` es solo de administración de la base. La aplicación
utiliza otras dos credenciales separadas:
`APP_DB_PASSWORD` para `lp_api` y `AUTH_DB_PASSWORD` para `lp_auth`.
Genera cada una con `openssl rand -hex 32`. Nunca subas contraseñas
ni `.env.production` a GitHub.

## Primer superadministrador
Se crea con el script `scripts/bootstrap-admin.mjs` dentro del
contenedor de migración, tras haber aplicado migraciones.
No depende de SQL Editor de Supabase.

## Cuentas
Las cuentas y sesiones viven en `auth.users` y `auth.sessions` de
tu PostgreSQL. Registro normal, verificación por correo y recuperación
requieren SMTP funcional. El primer administrador se crea manualmente
y confirmado mediante el script de bootstrap.

## Seguridad y limitaciones
Las operaciones de puntos/sellos/canje son transacciones con
controles PostgreSQL, roles y verificaciones de permisos.
El código QR identifica una tarjeta, **no prueba una compra**.
Todos los envíos masivos son borradores; se requiere proveedor de email,
consentimientos y bajas para activarlos. Stripe es opcional y necesita
secreto de webhook; no actives cobros hasta probar el flujo completo.
Antes de abrir a usuarios reales, probar aislamiento, reversión,
concurrencia, SSL sobre la IP, recuperación de backups y antifraude.
