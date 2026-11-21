# Google Wallet en Kreyv

Tener Google Wallet instalada en el móvil **no habilita la emisión de pases**. El servidor de Kreyv necesita una cuenta de emisor y una cuenta de servicio de Google.

## Preparación (propietario / desarrollador de Kreyv)

1. Accede a [Google Pay & Wallet Console](https://pay.google.com/business/console/) y crea una cuenta **Google Wallet API Issuer**. Anota el Issuer ID.
2. En [Google Cloud Console](https://console.cloud.google.com/) activa Google Wallet API y crea una **cuenta de servicio**. Descarga una clave JSON de esa cuenta en un entorno seguro.
3. En Google Pay & Wallet Console → **Users**, invita el correo de la cuenta de servicio con el rol **Developer**. Este permiso es imprescindible para firmar los pases como emisor.
4. Configura en el servidor, dentro de \`/opt/lp/.env.production\` (nunca en GitHub ni en código):
   - \`NEXT_PUBLIC_SITE_URL=https://dominio-real-de-kreyv\` (dominio propio con HTTPS, no IP).
   - \`GOOGLE_WALLET_ISSUER_ID\`: Issuer ID del panel.
   - \`GOOGLE_WALLET_SERVICE_EMAIL\`: campo \`client_email\` de la cuenta de servicio.
   - \`GOOGLE_WALLET_PRIVATE_KEY_B64\`: clave PEM \`private_key\` del JSON, codificada en Base64 sin saltos de línea.
5. Reinicia el contenedor de aplicación con la configuración nueva (el despliegue automático usa \`.env.production\` del VPS).
6. Comprueba \`https://dominio-real-de-kreyv/api/local/wallet/status\`: \`google\` debe aparecer como \`true\`. Esto confirma variables, **no** sustituye el test real del pase en Google Wallet.
7. Prueba "Añadir a Google Wallet" desde una cuenta permitida. Al principio el emisor está en **Demo Mode** y solo admite administradores, desarrolladores y cuentas de prueba añadidas en la consola.
8. Cuando la integración de prueba funcione, solicita **Publishing access** en Google Pay & Wallet Console para que los clientes reales puedan añadir pases.

### Seguridad y problemas habituales

- No compartas aquí, por correo ni en el repositorio \`private_key\`, el JSON de la cuenta de servicio ni archivos \`.env\` completos.
- La aplicación verifica que \`NEXT_PUBLIC_SITE_URL\` sea HTTPS **con dominio**. Si aún apunta a \`https://169.58.121.198\`, Google Wallet permanecerá desactivado aunque haya credenciales.
- El código del enlace \`/api/local/wallet/google?card=<id>\` está preparado para generar un JWT firmado; sin los datos anteriores responde con integración deshabilitada.
- Antes de usarlo con clientes, confirma en el móvil que Google acepta el pase; la verificación de variables por sí sola no prueba que Google haya autorizado al emisor.

Documentación oficial: [crear cuenta de emisor](https://developers.google.com/wallet/generic/getting-started/issuer-onboarding), [cuenta de servicio y permisos](https://developers.google.com/wallet/generic/getting-started/auth/rest), [publicar pases](https://developers.google.com/wallet/retail/loyalty-cards/test-and-go-live/request-publishing-access).
