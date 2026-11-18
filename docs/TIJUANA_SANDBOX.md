# Loyally · Sandbox de Tijuana

Esta rama incorpora diez negocios y ubicaciones **ficticios**, las categorías iniciales y una prueba de los tres programas (sellos, puntos y cashback). Las coordenadas aproximan barrios de Tijuana y **no representan establecimientos reales**.

## Acceso con cuentas auténticas

Los accesos rápidos públicos de `/acceder` siguen siendo ficticios y quedan en el navegador; **nunca comparten una contraseña de administración real**. Para probar el flujo de `auth.users` con sesiones auténticas, crear un despliegue separado con su propia base de datos:

1. Instalar migraciones en una base vacía cuyo nombre sea `lp_sandbox`, `lp_demo` o `lp_test`, usando `npm run db:migrate`.
2. Configurar `LP_SANDBOX_MODE=true` y una clave aleatoria **solo de pruebas** en `LP_DEMO_PASSWORD` (12+ caracteres).
3. Ejecutar `npm run db:seed:tijuana` **una sola vez**. Se niega a ejecutarse en una base con cuentas o negocios existentes.
4. Solo en ese despliegue aislado, configurar `NEXT_PUBLIC_LP_SANDBOX_MODE=true` y `NEXT_PUBLIC_LP_SANDBOX_PASSWORD` con la misma clave de pruebas. El botón de perfil completará los campos de usuario y contraseña e iniciará una sesión real.
5. No habilitar **nunca** estos indicadores en producción. Las variables `NEXT_PUBLIC_*` son públicas y la contraseña de demo se incluye en el navegador cuando se opta por este modo.

Las cuentas de prueba son `admin@demo.loyally.test`, `gestor@demo.loyally.test`, `empleado@demo.loyally.test`, `cliente@demo.loyally.test`. El dominio `.test` no recibe correo real. Todas las contraseñas de prueba comparten únicamente la clave configurada en el entorno de pruebas. En producción, las altas y verificaciones de correo son independientes.

## Vista de negocio y cliente

- En `/app/descubrir` aparece un mapa OpenStreetMap con las ubicaciones, categorías y filtros de sellos, puntos y cashback; la ubicación del cliente solo se pide con permiso. Las tarjetas se agregan a la cuenta actual sin duplicar registro.
- En el panel del negocio, la configuración se organiza en menú lateral; se admiten veinte colores predeterminados, selector RGB, color de letras, color del sello, imagen de fondo y SVG nuevos.
- En el registro global se solicitan nombre, apellidos, correo y WhatsApp en formato E.164, separados del consentimiento para campañas.
- Un disparador de base de datos emite un QR distinto cuando se alcanza el objetivo. El personal puede escanearlo una sola vez; el saldo y la entrega quedan auditados. El envío transaccional de la recompensa por email requiere SMTP.

## Mailing, consentimiento y facturación

- Las direcciones de clientes quedan en el servidor. El negocio consulta un **correo enmascarado**; no tiene acceso directo a la dirección real.
- Solo se encolan destinatarios que verificaron su cuenta y dieron consentimiento de marketing **a ese negocio**. Cada correo incluye enlace de baja.
- La plataforma puede configurar el precio en **centavos por contacto** y la moneda en la vista de administración del negocio. La cotización se confirma antes del envío.
- Se registran envíos aceptados por SMTP en `marketing_usage_ledger` con idempotencia; no se registra cargo por un envío rechazado por SMTP. La aceptación SMTP **no garantiza entrega final**.
- Para habilitar el envío de campañas en un servidor propio, configurar `SMTP_HOST`, `SMTP_FROM`, credenciales SMTP si proceden, `NEXT_PUBLIC_SITE_URL` y `LP_ENABLE_MARKETING_SEND=true`. Sin ello, solo funcionan los borradores y presupuestos. Cada solicitud envía hasta diez emails y se pueden continuar lotes pendientes.
- El ledger registra el consumo; **no realiza un cobro automático a tarjeta** ni crea facturas fiscales. Eso requiere integrar y validar el proveedor de pagos y los requisitos fiscales locales antes de activarlo comercialmente.

## Pruebas

La CI valida la compilación, las migraciones PostgreSQL, permisos de roles y una instalación sandbox completa. El comando `node tests/native/tijuana.mjs`, tras sembrar la base aislada, verifica que existan diez negocios, cuatro cuentas, QR no reutilizable, emails enmascarados y tarifa de campaña. No desplegar la rama hasta que todas las pruebas pasen.
