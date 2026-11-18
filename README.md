# Loyally (LP) — SaaS de fidelización

Aplicación multiempresa para negocios locales y sus clientes: tarjetas QR,
sellos, puntos, cashback, empleados, recompensas, ubicaciones, borradores
de campañas, solicitudes de acceso y facturación opcional.

## Infraestructura propia

- Next.js 15 / TypeScript.
- PostgreSQL 17 **local** en Contabo, con volumen Docker persistente.
- Registro, sesiones y recuperación de cuentas en PostgreSQL + correo SMTP.
- API propia y políticas de aislamiento RLS en PostgreSQL.
- Imágenes y fondos en volumen Docker privado; enlaces públicos protegidos por tipos MIME.
- GitHub Actions: pruebas en PR y despliegue automático de **main** exclusivamente a LP.
- Caddy existente en el VPS apunta al contenedor de LP en 127.0.0.1:3100.
- **No depende de ningún servicio de Supabase.**

Las migraciones históricas de `supabase/migrations` se aplican a PostgreSQL
nativo después de crear los esquemas de compatibilidad `auth` y `storage`.
Son archivos SQL heredados, no una conexión a Supabase.

## Producción

Consulta [docs/DEPLOY_POSTGRES.md](docs/DEPLOY_POSTGRES.md) para las variables,
pruebas, inicio del contenedor, primer administrador y despliegues automáticos.
El fichero `.env.production` es **solo del servidor**, no se guarda en Git.

**No exponer la aplicación a clientes sin verificar** login, SMTP,
aislamiento entre negocios, HTTPS, copias de seguridad y pruebas de fidelización
concurrencias, reversiones y webhooks. La integración Stripe es opcional y los
envíos masivos siguen siendo borradores.

## Desarrollo

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

Para funciones privadas necesitas una instancia PostgreSQL migrada y las
variables de conexión del servidor. No pongas credenciales en
`NEXT_PUBLIC_*`: el navegador solo llama a `/api/local/*`.
