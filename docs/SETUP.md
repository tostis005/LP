# LP — Configuración de PostgreSQL local

La instalación de LP ya no utiliza el servicio Supabase.
Sigue los pasos actualizados de docs/DEPLOY_POSTGRES.md para levantar
PostgreSQL 17, aplicar migraciones, crear el administrador y configurar
la IP pública con Caddy.

Las migraciones 001 a 009 se conservan por compatibilidad del modelo SQL,
pero se ejecutan sobre PostgreSQL nativo mediante un bootstrap en
db/migrations/000_bootstrap.sql. Las políticas RLS mantienen el aislamiento
de cada negocio.

El registro público necesita SMTP, y Stripe debe configurarse por separado.
El alta de un negocio corresponde solo al superadministrador. Google y Apple
OAuth no están habilitados. Las campañas de marketing son borradores.
