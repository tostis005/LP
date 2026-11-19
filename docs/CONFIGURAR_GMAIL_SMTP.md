# Gmail temporal para verificar cuentas de Loyally

El registro de clientes requiere confirmar la dirección de correo. El backend ya envía por Nodemailer con SMTP; no hace falta sustituir la autenticación.

## Configurar sin enviar contraseñas al chat

1. En la cuenta personal de Gmail activa la **verificación en dos pasos**: https://myaccount.google.com/security
2. Genera una **contraseña de aplicación** en https://myaccount.google.com/apppasswords (si tu cuenta permite esta opción).
3. En GitHub, repositorio LP → Settings → Secrets and variables → Actions, crea:
   - `LOYALLY_GMAIL_ADDRESS`: tu dirección completa `…@gmail.com`.
   - `LOYALLY_GMAIL_APP_PASSWORD`: los 16 caracteres de la contraseña de aplicación, sin espacios.
4. En GitHub → Actions → **Configurar Gmail SMTP de Loyally** → Run workflow (rama `main`).
5. El workflow transmite ambos secretos por SSH a Contabo y los guarda únicamente en `/opt/lp/.env.production`; reinicia solo `web`. Nunca registra credenciales en logs ni las añade al repositorio.
6. Comprueba el alta de un cliente real: introduce nombre, correo y contraseña, verifica que llega el correo y pulsa el enlace para confirmar. Después entra y guarda una tarjeta.

Configuración resultante en el servidor (sin mostrar secretos):
```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=TU_CUENTA_GMAIL
SMTP_PASSWORD=CONTRASEÑA_DE_APLICACION_PRIVADA
SMTP_FROM=TU_CUENTA_GMAIL
```

**Importante:** Gmail personal es una solución de pruebas con limitaciones de volumen y reputación; antes del lanzamiento comercial cambia a un proveedor transaccional (SES, Postmark, Brevo o similar). No utilices tu contraseña habitual de Gmail, no facilites la contraseña de aplicación por chat y no la guardes en Git. El workflow puede volver a ejecutarse si rotas la contraseña de aplicación.

## Permisos push en la PWA

La PWA Android/iPhone debe solicitar permiso del sistema, que no se puede conceder silenciosamente. En `/app`, cuando una persona entra por primera vez con su PWA instalada, se presenta una ventana de bienvenida para ofrecer la activación. Solo cuando pulsa **Permitir notificaciones** aparece el permiso nativo del teléfono. Los negocios a los que acepta recibir promociones se seleccionan expresamente y son opcionales. Si responde «Ahora no», no se vuelve a molestar; las preferencias permanecen disponibles en **Avisos**.

Una cuenta ficticia del modo demostración permite visualizar la interfaz pero no registrar dispositivos reales ni comprobar campañas; para las pruebas de push hay que confirmar un correo e iniciar sesión con una cuenta cliente real.
