# LP — configuración sin afectar a HOME

## Requisitos
- Node.js 20+ y npm.
- Proyecto Supabase independiente (no reutilizar una base de WordPress).
- Entorno .env.local con URL y anon key públicos de Supabase.
- No introducir secretos de servidor en NEXT_PUBLIC_.

## Pasos
1. `npm install`
2. En Supabase SQL Editor ejecuta las migraciones `001_initial.sql`, `002_directories.sql`, `003_guardrails.sql`, `004_join_links.sql`, `005_invite_privacy.sql` y `006_admin_fields.sql` y `007_reversals_and_limits.sql` y `008_billing.sql` y `009_leads.sql` **en ese orden**, una vez en un proyecto vacío.
3. Copia `.env.example` a `.env.local` y configura URL y anon key.
4. Configura Supabase Auth: email + confirmación obligatoria. En la lista de URL de redirección añade `http://localhost:3000/auth/callback` y `http://localhost:3000/auth/callback?next=password` (y sus equivalentes de producción).
5. `npm run dev` y abre `http://localhost:3000`.
6. Registra tu cuenta y confirma el email. Desde el SQL Editor, identifica el UUID del usuario en Authentication > Users y ejecuta **manualmente**:
   ```sql
   insert into public.platform_admins(user_id) values ('UUID_DE_TU_USUARIO');
   ```
7. Entra en /admin y crea un negocio indicando el email de su responsable. No hay alta pública de negocios: el superadministrador lo crea.
8. El responsable verifica su email e inicia sesión; al acceder se reclaman sus invitaciones pendientes. Puede configurar su programa y dar de alta empleados.

## Configuración opcional de login social
En Supabase Auth habilita Google y/o Apple. Configura credenciales del proveedor, callback y URLs permitidas en ambos lados. La UI puede mostrar estos botones, pero no serán operativos hasta configurarlos. No se incluyen secretos.

## Diseño y activos
Colores iniciales: verde profundo, salvia y crema, con tonos melocotón. Los fondos de tarjeta y logos se almacenan en bucket público business-assets por carpeta del ID del negocio; el programa valida que la subida procede de un owner/manager.

## Directorio y mapa
Las ubicaciones (latitud y longitud) son configurables por el negocio. Se muestran solo si public_listing=true, active=true y location.visible=true. La geolocalización del navegador es opt-in; no se persiste en base de datos. Mapa Leaflet con teselas OpenStreetMap. Para tráfico comercial elevado usar proveedor de mapas con SLA y términos adecuados.

## Fidelización / seguridad
- Un QR único por tarjeta cliente-negocio. No acredita ninguna compra.
- Solo un empleado autenticado puede consultar una tarjeta y registrar puntos/sellos/cashback mediante RPC con comprobaciones en PostgreSQL.
- Tope por operación y tiempo mínimo configurable.
- Ticket de referencia opcional, único por negocio si se indica.
- Saldo y libro de operaciones quedan sincronizados dentro de una misma transacción PostgreSQL.
- No se puede garantizar la honestidad de un empleado sin transacción real del TPV. La integración TPV y la conciliación de tickets se planifican aparte.

## Pendiente de integración comercial
- Emisión y actualización de Apple Wallet: requiere certificados y servicio para firmar .pkpass, endpoints de actualizaciones.
- Google Wallet: requiere cuenta issuer y credenciales de su API.
- Stripe: cuenta, webhook seguro y suscripción por negocio.
- Emails masivos: proveedor transaccional, verificación de dominio, bajas, límites, facturación por consumo. De momento se guardan borradores, **no** se envían campañas.
- Infraestructura: Docker, proxy y dominio de Contabo. HOME permanece intacto.

## Facturación opcional (Stripe)
- Por defecto `platform_billing_settings.billing_enforced=false`: los negocios pueden probar el software sin pagos reales.
- Configura variables privadas `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y `STRIPE_PRICE_BUSINESS`, además de `NEXT_PUBLIC_SITE_URL`.
- Configura el webhook POST `/api/billing/webhook` en Stripe para `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` y `customer.subscription.deleted`.
- El propietario puede crear la sesión de Checkout y gestionar su cuenta desde `/negocio/facturacion`. Stripe confirma el estado mediante webhooks firmados. El retorno a la web no confirma un pago.
- No actives `billing_enforced` antes de comprobar webhooks, estados, reversión de pagos y pruebas de suscripciones. Después, un operador de confianza debe habilitarlo explícitamente por SQL.
- Los secretos nunca se envían al navegador ni se almacenan en el repositorio.

## Captación de negocios sin alta automática
- Página pública: `/solicitar-acceso`. El formulario necesita una `SUPABASE_SERVICE_ROLE_KEY` **solo en el servidor**.
- Las solicitudes se guardan en `business_leads` y son visibles únicamente al superadministrador. Un mismo correo no puede enviar dos solicitudes en 24 horas; antes del lanzamiento debería añadirse protección de bots/CAPTCHA y políticas legales.
- En `/admin` > Solicitudes, el superadministrador revisa, marca como contactada, archiva o convierte una solicitud en negocio. Convertir crea la invitación de responsable de forma transaccional, pero no envía email automáticamente.
