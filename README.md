# LP — Loyalty Platform

Plataforma SaaS multiempresa de fidelización. Repositorio independiente de HOME.

## Stack
Next.js (App Router) + TypeScript + Supabase (Auth, PostgreSQL, RLS) + React + CSS moderno.

## Estado
Primera fase: experiencia visual, autenticación, paneles de cliente/negocio/empleado/superadministración, programas de sellos/puntos/cashback, historial, control de operaciones, directorio geográfico, estructura de permisos y campañas.

## Inicio
1. Copia `.env.example` a `.env.local` y configura Supabase.
2. Ejecuta las migraciones SQL de `supabase/migrations` en orden desde Supabase SQL Editor.
3. `npm install && npm run dev`.
4. Registra un usuario y asígnale superadministración desde el SQL Editor usando el comando indicado en `docs/SETUP.md`.
5. Abre `/demo` para explorar el diseño sin conexión ni datos reales.

### Seguridad
No almacenar claves privadas en Git. Las operaciones de fidelización usan funciones PostgreSQL con comprobaciones de rol y límites. El código QR identifica una tarjeta, pero **no verifica una compra**: siempre se valida por un empleado autenticado; integraciones TPV son una mejora futura.

### Entorno de producción
Por ahora **NO se despliega nada**. HOME, su WordPress, sus datos y su GitHub Action permanecen intactos. LP tendrá un Docker y despliegue independientes en una fase posterior.
