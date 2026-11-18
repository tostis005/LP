# LP en Contabo: Docker y PostgreSQL nativo

LP no necesita Supabase y NO modifica HOME ni otros proyectos. Caddy sigue
sirviendo los puertos 80/443; LP escucha solo en 127.0.0.1:3100.

## Actualizar el código en el servidor

    cd /opt/lp
    git fetch origin
    git switch infra/postgresql-docker
    git pull --ff-only origin infra/postgresql-docker

Cuando los cambios pasen las pruebas y se integren a main, cambia a main.

## Completar /opt/lp/.env.production

Conserva exactamente el POSTGRES_PASSWORD que ya utilizaste al crear
el volumen lp_postgres_data. Añade DOS contraseñas nuevas, diferentes:

    APP_DB_PASSWORD=(64 dígitos hexadecimales)
    AUTH_DB_PASSWORD=(64 dígitos hexadecimales)

Genera cada una ejecutando openssl rand -hex 32.
La URL se configura como NEXT_PUBLIC_SITE_URL=https://169.58.121.198.
Nunca publiques este archivo ni cambies POSTGRES_PASSWORD de una DB
existente pensando que Docker rotará la clave: no lo hace.

Para registros de clientes y recuperación de contraseña, configura
SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD y SMTP_FROM
de tu servidor de correo. Sin SMTP, solo se habilitan cuentas verificadas
por bootstrap de administración; NO se confirman emails sin verificar.

## Iniciar aplicación y migraciones

    cd /opt/lp
    docker compose --env-file .env.production config --quiet
    docker compose --env-file .env.production up -d --build
    docker compose --env-file .env.production ps
    docker compose --env-file .env.production logs --tail=100 migrate
    docker compose --env-file .env.production logs --tail=100 web

El servicio migrate crea roles de SQL limitados y ejecuta una sola vez
000_bootstrap y migraciones 001 a 009 junto con 010_native.sql.
web arranca solo tras migración correcta. PostgreSQL no expone 5432.

Comprueba el backend ANTES de recargar Caddy:

    curl -i http://127.0.0.1:3100/api/health
    curl -I http://127.0.0.1:3100

El endpoint /api/health devuelve status ok y database connected.

## Crear primer superadministrador

Con la imagen de migrate creada:

    cd /opt/lp
    read -rp 'Correo del administrador: ' LP_ADMIN_EMAIL
    read -srp 'Contraseña nueva (12 o más caracteres): ' LP_ADMIN_PASSWORD; echo
    export LP_ADMIN_EMAIL LP_ADMIN_PASSWORD
    docker compose --env-file .env.production run --rm -e LP_ADMIN_EMAIL -e LP_ADMIN_PASSWORD migrate node scripts/bootstrap-admin.mjs
    unset LP_ADMIN_EMAIL LP_ADMIN_PASSWORD

Accede a /acceder y utiliza /admin para gestionar negocios. Si existe
el usuario, bootstrap-admin no cambiará su contraseña.

## Configurar Caddy para la IP

En /etc/caddy/Caddyfile, cambia SOLO las líneas reverse_proxy de los
bloques que ya existen para http://169.58.121.198 y
https://169.58.121.198 hacia 127.0.0.1:3100. Conserva el bloque tls
y TODOS los dominios existentes. Valida y recarga:

    sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup-lp
    sudo caddy validate --config /etc/caddy/Caddyfile
    sudo systemctl reload caddy

Usar HTTPS solo si la IP dispone de certificado válido en el navegador.

## Estado funcional

- Landing, solicitudes de acceso, cuentas y sesiones locales.
- Programas de sellos, puntos y cashback en PostgreSQL con control
  de permisos y límites antifraude.
- Gestión de negocios, empleados, clientes, tarjetas QR, reversión,
  estadísticas, directorio, consentimientos y campañas como borradores.
- Upload de logos y fondos a volumen Docker persistente.
- Facturación Stripe opcional con webhook firmado; cobro obligatorio
  DESACTIVADO hasta configuración y pruebas reales.
- Google/Apple OAuth y envío masivo de campañas aún no implementados.

## Seguridad operativa

Hacer backups externos y comprobar restauración de DOS volúmenes:
lp_postgres_data y lp_uploads. Monitoriza espacio, logs y certificados.
No publiques el puerto de DB. No admitas cuentas reales antes de probar
SSL, SMTP, autenticación, permisos de negocio y operaciones concurrentes.
