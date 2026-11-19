# Despliegue de LP en el VPS Contabo (PostgreSQL propio)

## Aislamiento de los proyectos existentes

- LP usa `/opt/lp`, proyecto Docker `lp` y puerto `127.0.0.1:3100`.
- PostgreSQL 17 se ejecuta como `lp-db-1` y **no publica** el puerto 5432.
- El volumen `lp_postgres_data` ya iniciado por el operador se conserva.
- Caddy sigue gestionando 80/443; no instalar Nginx ni parar los servicios
  de HOME, Farmawao, familycitylife u otros.
- La IP pública actual es `169.58.121.198`, con HTTPS gestionado por Caddy.

## 1. Preparar .env.production

```bash
cd /opt/lp
nano .env.production
chmod 600 .env.production
```

Debe contener al menos:

```dotenv
POSTGRES_DB=lp
POSTGRES_USER=lp
POSTGRES_PASSWORD=TU_PASSWORD_POSTGRES_EXISTENTE
APP_DB_PASSWORD=GENERA_UNA_CLAVE_DISTINTA_HEX_64
AUTH_DB_PASSWORD=GENERA_OTRA_CLAVE_DISTINTA_HEX_64
NEXT_PUBLIC_SITE_URL=https://169.58.121.198
```

**Conserva** la contraseña `POSTGRES_PASSWORD` utilizada al iniciar
el volumen. No la cambies a ciegas: PostgreSQL no cambia la contraseña
existente solo por cambiar el entorno. Para nuevas contraseñas ejecuta
dos veces `openssl rand -hex 32`.

Opcionales según funciones:
`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
`SMTP_PASSWORD`, `SMTP_FROM`: **necesarios para registrar nuevos
clientes y enviar confirmaciones/recuperaciones de contraseña**.
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BUSINESS`:
necesarios para cobrar suscripciones. No actives cobros sin pruebas.

**No publiques `.env.production`, ni lo subas a GitHub Secrets** si ya
está en el VPS. Los secretos de SSH y estos valores tienen usos distintos.

## 2. Actualizar rama principal después del PR

El GitHub Action automático trae `main` a `/opt/lp`. Si quieres
inspeccionar manualmente los cambios, revisa primero el PR en GitHub.

```bash
cd /opt/lp
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
curl -fsS http://127.0.0.1:3100/api/health
```

La ejecución levanta `db`, aplica las migraciones con `migrate`
y después arranca `web`. No ejecutar las migraciones antiguas a mano
en una base sin esquema de compatibilidad. La primera instalación debe
comprobar que el volumen PostgreSQL está `healthy`.

## 3. Crear el primer administrador

Tras terminar las migraciones, crea un administrador confirmado
sin dejar su contraseña en el historial:

```bash
cd /opt/lp
read -rp "Email administrador: " LP_ADMIN_EMAIL
read -rsp "Contraseña (12+ caracteres): " LP_ADMIN_PASSWORD
echo
export LP_ADMIN_EMAIL LP_ADMIN_PASSWORD
docker compose --env-file .env.production run --rm \\
  -e LP_ADMIN_EMAIL -e LP_ADMIN_PASSWORD migrate \\
  node scripts/bootstrap-admin.mjs
unset LP_ADMIN_PASSWORD LP_ADMIN_EMAIL
```

El login estará en `/acceder` y el panel en `/admin`.
Las altas de clientes/empleados necesitan SMTP configurado.
El script no sustituye la contraseña de un usuario existente.

## 4. Caddy: publicar LP en la IP, sin afectar a dominios

Mantén las reglas de dominios existentes sin cambios. En el Caddyfile
del servidor, los bloques `http://169.58.121.198` y
`https://169.58.121.198` deben apuntar a:

```caddyfile
reverse_proxy 127.0.0.1:3100
```

El bloque HTTPS ya incluye configuración TLS específica: conservarla,
sin añadir otro servidor en los puertos 80/443. **Antes de recargar**,
verifica que `curl -fsS http://127.0.0.1:3100/api/health` funciona.
Valida `sudo caddy validate --config /etc/caddy/Caddyfile`
y después `sudo systemctl reload caddy`. Comprueba con navegador
que el certificado HTTPS de IP no da errores. Si el certificado no
es válido, no uses cuentas reales hasta corregirlo.

## 5. GitHub Actions: CI y deploy automático

Cada push a `main` ejecuta `.github/workflows/deploy.yml`:
1. Instala dependencias, verifica TypeScript y compila Next.js.
2. Crea PostgreSQL de prueba, migra el esquema y comprueba aislamiento.
3. Si todo pasa, conecta por SSH a Contabo y actualiza **solo `/opt/lp`**.
4. `docker compose up -d --build` aplica nuevas migraciones en LP;
   después comprueba `http://127.0.0.1:3100/api/health`.
5. Si fallan las pruebas, la acción de deploy no se ejecuta.

Se utilizan los **tres secretos ya existentes** del repositorio GitHub (también
pueden definirse en el entorno `production`):
- `VPS_HOST`: IP del VPS (169.58.121.198).
- `VPS_USER`: usuario SSH con acceso a `/opt/lp` y Docker.
- `VPS_SSH_KEY`: clave privada SSH sin frase de paso, con acceso autorizado en el VPS.

Opcionales:
- `VPS_SSH_PORT`: puerto SSH, por defecto 22.
- `LP_SSH_KNOWN_HOSTS`: clave pública de host **contrastada previamente** con
  la huella obtenida en el VPS. Este valor fija la identidad del servidor
  y protege contra suplantaciones. Cuando no existe, el workflow hace
  `ssh-keyscan` y aplica confianza en el primer contacto (TOFU), que **no
  verifica de forma independiente la identidad del VPS**. Configurar el
  secreto de huella verificada antes de usar datos de producción sensibles.

Si cambian los nombres de los secretos, hay que actualizar también las referencias en el workflow.
El repositorio debe tener los GitHub Actions habilitados y el SSH
debe permitir autenticarse con la clave correspondiente.
El workflow usa el entorno `production`, que se puede proteger
con aprobación manual si así lo decides; sin reglas de protección,
el despliegue es automático al fusionar/publicar en `main`.

**La rama `infra/postgresql-docker` y el PR no desencadenan
despliegue al VPS hasta incorporarse a `main`.**
El código y las migraciones deben validarse antes de integrar.

## 6. Backups y operaciones

`lp_postgres_data` es persistencia, no backup. Programa copias
en una ubicación **fuera del VPS**, cifradas, y prueba restauraciones.

Copia manual desde la carpeta del despliegue:

```bash
mkdir -p /opt/lp/backups
cd /opt/lp
docker compose --env-file .env.production exec -T db \\
  sh -c 'exec pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \\
  | gzip > "backups/lp-$(date +%F-%H%M).sql.gz"
```

Además del dump, respalda por separado el volumen `lp_uploads`
de las imágenes. Mantén backups fuera del servidor, controla espacio
y actualiza dependencias con pruebas antes de aplicar cambios.

## 7. Validación antes de admitir clientes

- Probar login/confirmación, recuperación SMTP y roles por empresa.
- Crear negocio e invitaciones, escanear y canjear en simultáneo.
- Verificar límites antifraude, reversiones y saldo consistente.
- Aislamiento entre negocios y subida/visualización de imágenes.
- Revisar HTTPS válido, backups y restauraciones.
- Stripe: webhook firmado, idempotencia, suscripciones y cancelaciones.
- Los emails masivos siguen sin enviarse, solo se guardan borradores.

## 8. Inicio de sesión con Google y Apple

El código de OAuth de Loyally utiliza exclusivamente nuestro servidor y PostgreSQL. Los
proveedores confirman la identidad y Loyally crea su propia sesión segura en cookie
HTTP-only, sin guardar sus tokens de acceso. Las cuentas existentes por email se vinculan
si el proveedor acredita la titularidad de exactamente ese correo.

**Antes de activar las opciones:** publicar Loyally bajo un **dominio propio con HTTPS
válido**. La IP `169.58.121.198` no es una URL válida para registrar el retorno
de Apple, y Google también exige dominios de retorno autorizados.

Por ejemplo, al configurar el dominio `https://loyally.ejemplo.com`:

1. Establecer `NEXT_PUBLIC_SITE_URL=https://loyally.ejemplo.com` en
   `/opt/lp/.env.production` y configurar DNS + Caddy con un certificado válido.
   Comprobar que Caddy apunta al contenedor y que /api/health responde.
2. En **Google Cloud Console → Google Auth Platform**, crear cliente OAuth tipo
   **Aplicación web**, con dirección de retorno exacta
   `https://loyally.ejemplo.com/api/local/oauth/google/callback`.
   Añadir `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET`.
   Solicitar únicamente `openid email profile`.
3. En **Apple Developer → Identifiers**, configurar Sign in with Apple con el
   **App ID principal**, registrar un **Services ID** para el sitio, asociar el
   dominio y retorno exacto
   `https://loyally.ejemplo.com/api/local/oauth/apple/callback`.
   Crear una clave de Sign in with Apple para el Team ID. Guardar:
   `APPLE_OAUTH_SERVICE_ID`, `APPLE_OAUTH_TEAM_ID`,
   `APPLE_OAUTH_KEY_ID` y `APPLE_OAUTH_PRIVATE_KEY_B64`.
   Para generar el valor base64 de la clave original `.p8`:
   `base64 -w0 AuthKey_XXXXX.p8` (en macOS: `base64 -i AuthKey_XXXXX.p8 | tr -d '\\n'`).
4. Reiniciar únicamente el servicio web en Docker:
   `docker compose --env-file .env.production up -d --build web`.
5. Verificar desde el dominio, sin exponer claves, que
   `/api/local/oauth/providers` muestra `google:true` o `apple:true`.
   La UI muestra los botones exclusivamente de los proveedores configurados.
6. Probar inicio de sesión nuevo y recurrente, retorno a /app, cancelación
   del consentimiento y vinculación con una cuenta por email existente.

En Apple, **«Ocultar mi correo»** puede asignar un correo alternativo de Apple; para
poder enviar notificaciones a esa dirección, registrar el dominio de envío en
**Private Email Relay** y configurar SMTP más adelante. Los inicios con Google y Apple
no necesitan enviar correos SMTP de confirmación. Las cuentas tradicionales de
email y contraseña y sus recuperaciones **siguen requiriendo SMTP**.

Las claves y secretos deben quedar solo en el entorno del servidor, nunca en
GitHub ni en archivos `NEXT_PUBLIC_*`. Para Apple, la afiliación a
Apple Developer tiene una cuota anual que debe presupuestarse.
