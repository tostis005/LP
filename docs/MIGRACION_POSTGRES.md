# Migración de LP a PostgreSQL propio (sin Supabase)

## Punto de partida comprobado

Actualmente `package.json` incluye `@supabase/supabase-js` y
`lib/supabase.ts` expone un cliente Supabase utilizado por la aplicación.
Las migraciones `supabase/migrations/001_initial.sql` a `009_leads.sql`
dependen de `auth.users`, `auth.uid()`, roles `authenticated`/`anon`,
políticas RLS y funciones de Supabase. **No son ejecutables tal cual en
PostgreSQL vacío** y el contenedor PostgreSQL no convierte esas dependencias.

## Decisión de arquitectura

- PostgreSQL 17 nativo en Docker: base privada, sin 5432 público.
- Solo el servidor Next.js abre conexiones a PostgreSQL (biblioteca `pg`
  o `Drizzle ORM` con `pg`); el navegador nunca recibe credenciales.
- Autenticación propia respaldada por PostgreSQL (p. ej. Auth.js con adaptador
  de PostgreSQL, sesiones seguras y contraseñas con Argon2id si se usa contraseña).
- Esquema de usuarios/roles propio. El identificador de usuario será UUID.
- Autorización multiempresa comprobada en cada endpoint y operación; no confiar
  en un `business_id` que envíe el navegador.
- Operaciones de fidelidad y canje en transacciones PostgreSQL atómicas,
  con bloqueo/concurrencia y auditoría, conservando los límites antifraude.
- Ficheros/logo: almacenamiento local persistente protegido o solución
  S3-compatible autohospedada; no Supabase Storage.
- Migraciones versionadas nuevas, separadas de `supabase/migrations`.

## Orden de implementación

1. Crear conexión de servidor PostgreSQL, sistema de migraciones y tablas
   `users`, sesiones, negocios, membresías, programas y movimientos.
2. Reescribir funciones SQL dependientes de `auth.uid()`, roles Supabase
   y RLS para un esquema nativo con permisos verificables. No desactivar
   controles de seguridad sin alternativa.
3. Sustituir el login, registro, confirmación de email y recuperación de
   contraseña. Añadir protección de sesiones, CSRF donde corresponda,
   rate limiting y verificación del correo.
4. Migrar cada llamada `db().from(...)`, `db().rpc(...)` y
   `db().auth...` a endpoints/server actions con autorización.
5. Migrar invitaciones, clientes, personal, QR, historial, rankings,
   campañas, leads y Stripe (webhooks/idempotencia).
6. Implementar almacenamiento de activos e impedir rutas de archivos
   atravesables o subidas inseguras.
7. Eliminar variables y dependencia Supabase; probar funcionalidades y
   multitenencia antes de habilitar el workflow automático.

## Atención

Este cambio no es una sustitución de `NEXT_PUBLIC_SUPABASE_URL` por
`DATABASE_URL`. Las migraciones antiguas no deben ejecutarse sin adaptar
funciones, dependencias y permisos. La primera etapa de infra puede
levantarse sola con `docker compose up -d db`; **LP no estará funcional
para clientes hasta completar esta migración**.
