# Web Push de Loyally (Android y iPhone sin tiendas)

## Funcionamiento

- La PWA usa el service worker `public/sw.js` para mostrar notificaciones mientras está cerrada.
- Cada **dispositivo** se registra con una suscripción Web Push del navegador, asociada a una cuenta cliente; no es necesario mantener la sesión abierta para recibir notificaciones después del registro.
- El cliente acepta por separado las campañas push de **cada negocio** del que tiene tarjeta. Tener la PWA instalada o tener una tarjeta no constituye consentimiento suficiente.
- El comerciante utiliza **Negocio > Mensajes y ofertas > Notificación push**. La cola incluye exclusivamente dispositivos activos de usuarios con tarjeta de ese negocio y aceptación push.
- Los comercios no acceden a endpoints ni claves de los dispositivos. No pueden enviar a clientes de otros negocios.
- Un mismo cliente con dos móviles puede recibir dos notificaciones; las cifras en el panel cuentan **dispositivos**, no personas.
- Una entrega «aceptada» significa que el proveedor push la ha admitido, no que el destinatario la haya leído. Los endpoints 404/410 se desactivan.
- Por seguridad, los envíos se procesan en lotes de 35 y el panel puede continuar las campañas grandes. Si el navegador del comerciante se cierra, la campaña queda pendiente y se puede reanudar desde el historial. No hay worker recurrente automático todavía.

## Requisitos

1. Publicar Loyally en un origen `https://` con certificado válido y confiable para móviles; puede ser una **IP pública** si su certificado incluye esa IP. El origen debe permanecer estable: cambiar IP/dominio requiere que los usuarios vuelvan a conceder o registrar sus suscripciones.
2. Desplegar la migración `db/migrations/180_web_push.sql` y la nueva versión de Loyally en el mismo despliegue de Docker.
3. Generar **un único** par de claves VAPID, una vez, en un entorno de confianza:

   ```bash
   npx web-push generate-vapid-keys
   ```

4. En `/opt/lp/.env.production`, añadir:

   ```dotenv
   LP_ENABLE_PUSH_SEND=true
   VAPID_PUBLIC_KEY=CLAVE_PUBLICA_GENERADA
   VAPID_PRIVATE_KEY=CLAVE_PRIVADA_GENERADA
   VAPID_SUBJECT=mailto:soporte@tu-dominio.example
   ```

   Sustituir el correo de ejemplo por un contacto real. La clave privada **jamás** debe copiarse en archivos del repositorio, conversaciones públicas ni frontend. Conservar el mismo par VAPID entre despliegues; su rotación requiere nuevas suscripciones.

5. Reconstruir el servicio con el procedimiento normal del proyecto: `docker compose --env-file .env.production up -d --build`. Comprobar `https://TU_ORIGEN/api/local/push/config`; debe devolver `enabled:true` y solo la clave **pública**.

Si `LP_ENABLE_PUSH_SEND` está desactivado o faltan las claves, la interfaz informa del bloqueo y no permite hacer envíos; correo y WhatsApp siguen funcionando.

## Prueba end-to-end

1. Crear una **cuenta de cliente real** y unirse a un negocio (tener una tarjeta de ese negocio).
2. Android: instalar/abrir la PWA desde Chrome y abrir «Mis tarjetas». iPhone iOS 16.4+: abrir Loyally en Safari, «Añadir a pantalla de inicio», abrirla desde el icono instalado. No pedir push desde una pestaña de Safari de iPhone.
3. En «Mis tarjetas > Notificaciones push», pulsar «Activar push en este dispositivo», aceptar el permiso del sistema y **marcar el negocio** deseado.
4. Acceder con la cuenta propietaria del negocio: «Mensajes y ofertas > Notificación push», escribir título y texto, confirmar destinatarios y enviar.
5. Con la PWA cerrada, comprobar que llega el aviso. Repetir con cliente de otro negocio: **no debe recibirlo**.
6. Desmarcar el negocio en el cliente y comprobar que desaparece del recuento de destinos elegibles. Desactivar push en el dispositivo y comprobar que ya no recibe avisos.
7. Revisar los valores de aceptados, fallidos y pendientes. Los clientes con sesión cerrada siguen recibiendo push en el dispositivo que previamente registraron.

## Privacidad y límites

Las notificaciones comerciales requieren permiso del navegador y consentimiento por negocio. Los opt-outs afectan al envío aunque la campaña estuviese previamente encolada. El sistema no envía a clientes únicamente porque tengan tarjeta, ni a los dispositivos que no hayan autorizado el canal.

Las notificaciones automáticas de premios, programación de campañas, procesado periódico de colas y analítica de apertura no forman parte de esta primera implementación; el envío manual y el historial sí.
