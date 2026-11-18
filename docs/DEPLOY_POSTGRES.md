# Despliegue independiente de LP en Contabo con PostgreSQL nativo

> **Estado**: infraestructura preparada, aplicación TODAVÍA NO migrada desde Supabase.
> No activar el despliegue real para clientes hasta completar `docs/MIGRACION_POSTGRES.md`.
> `docker compose up` puede levantar PostgreSQL aunque las pantallas privadas no funcionen.

## Arquitectura

- **LP web**: Next.js 15 en Docker, accesible en el servidor solo por `127.0.0.1:3100`.
- **LP db**: PostgreSQL 17 en Docker con volumen persistente `lp_postgres_data`, sin puerto publicado.
- **HTTPS**: se aprovecha el reverse proxy existente que ya usa HOME; no abrir un segundo 80/443.
- **Despliegue**: GitHub Actions por SSH, independiente del proyecto HOME.
- **Almacenamiento de ficheros**: pendiente de la migración; no depender de Supabase Storage.

## 1. Preparar el VPS

Necesitas un VPS Linux con Docker Engine + Docker Compose plugin, git, un dominio/subdominio
con registro DNS A hacia la IP del VPS y acceso por SSH con usuario de despliegue.
Antes de instalar nada, identifica quién ocupa 80 y 443:

```bash
sudo ss -lntp | grep -E ':(80|443)\\b'
docker ps --format 'table {{.Names}}\\t{{.Ports}}'
docker compose version
```

**No detengas ni sustituyas el proxy de HOME.**
Si falta Docker, sigue la instalación oficial para la distribución de tu VPS:
https://docs.docker.com/engine/install/

## 2. Instalar LP en carpeta independiente

Ejecuta como usuario de despliegue con permisos para ejecutar Docker (trata el
grupo `docker` como equivalente a administrador del servidor):

```bash
sudo mkdir -p /opt/lp
sudo chown "$USER":"$USER" /opt/lp
git clone https://github.com/tostis005/LP.git /opt/lp
cd /opt/lp
cp .env.production.example .env.production
chmod 600 .env.production
```

Edita `.env.production` en el VPS, nunca en GitHub:

```bash
nano .env.production
```

Variables: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`,
`AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`.
Genera claves distintas con `openssl rand -hex 32`.
En `NEXT_PUBLIC_SITE_URL` introduce `https://tu-subdominio`.
Los GitHub Secrets de SSH no sustituyen estas variables que deben existir en el servidor.

## 3. Contenedores

Solo después de que la migración a PostgreSQL esté lista:

```bash
cd /opt/lp
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs -f web
```

Si necesitas arrancar **solo PostgreSQL durante el desarrollo** sin lanzar la aplicación
todavía dependiente de Supabase:

```bash
docker compose --env-file .env.production up -d db
```

Desde `web`, la DB estará en `db:5432` con variables `PGHOST`,
`PGPORT`, `PGDATABASE`, `PGUSER` y `PGPASSWORD`.
**No publiques PostgreSQL en internet.**

## 4. Reverse proxy y HTTPS

Si HOME usa **Nginx instalado en el host**, crea otro `server` independiente
(por ejemplo `/etc/nginx/sites-available/lp`) adaptando el dominio:

```nginx
server {
    listen 80;
    server_name lp.tudominio.com;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

Habilita el sitio sin tocar la configuración de HOME, valida y recarga:

```bash
sudo ln -s /etc/nginx/sites-available/lp /etc/nginx/sites-enabled/lp
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d lp.tudominio.com
```

Esto supone que Nginx y Certbot ya están instalados/configurados.
Si HOME usa **Traefik, Caddy, Nginx Proxy Manager o Nginx en Docker**, NO
copies esta configuración: añade LP al proxy existente y adapta la red/ruta.
El contenedor solo está publicado en el loopback del host.

## 5. GitHub Actions (despliegue manual inicialmente)

Se incluye `.github/workflows/deploy.yml` solo con `workflow_dispatch`.
Se podrá activar `push: main` una vez que la migración a PostgreSQL y los tests pasen.
Confirma que en **Settings > Secrets and variables > Actions** existen
estos cuatro secretos (ajusta nombres en el workflow si los tuyos son distintos):

- `LP_SSH_HOST`: IP o host público del VPS.
- `LP_SSH_USER`: usuario de despliegue.
- `LP_SSH_PRIVATE_KEY`: clave SSH privada de despliegue.
- `LP_SSH_KNOWN_HOSTS`: línea `known_hosts` del VPS, **tras comprobar su huella**
  por un canal confiable (p. ej. consola de Contabo).

El VPS debe permitir autenticación por la correspondiente clave pública, y `/opt/lp`
debe contener un clone en la rama `main`.
El workflow hace `git pull --ff-only` y luego `docker compose up -d --build`.
No utiliza los secretos de HOME.

## 6. Copias de seguridad

El volumen de PostgreSQL no es una copia de seguridad. Programa copias
automáticas cifradas **fuera del VPS** y comprueba restauraciones periódicamente.
Ejemplo manual:

```bash
cd /opt/lp
mkdir -p backups
docker compose --env-file .env.production exec -T db \
  sh -c 'exec pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip > "backups/lp-$(date +%F-%H%M).sql.gz"
```

Protege `backups/` (y cópialo a almacenamiento externo), supervisa espacio,
monitoriza DB, actualiza imágenes y planifica recuperación ante fallos.

## 7. Criterios antes del lanzamiento

- Reemplazar autenticación, llamadas a Supabase y RPC de Supabase.
- Aplicar nuevo esquema y migraciones PostgreSQL nativas.
- Verificar aislamiento entre negocios y controles de permisos.
- Probar operaciones concurrentes de puntos/canje y reversión.
- Probar backups y restauraciones, HTTPS, email, Stripe y protección antiabuso.
- Crear `package-lock.json` y versionarlo para compilaciones reproducibles.
