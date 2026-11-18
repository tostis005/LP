# Alcance por fases

## Implementado en el código inicial
- Marca visual y landing, precios, demo navegable.
- Acceso con email/contraseña y OAuth configurables mediante Supabase.
- Panel de cliente: tarjetas, movimientos, perfil, consentimiento de plataforma, directorio y mapa.
- Panel de negocio: configuración, editor de tarjetas con preview, programa, ubicaciones, empleados, clientes, operaciones e indicadores.
- Panel de empleados: escáner de cámara, entrada manual, abono y canje de recompensas.
- Panel de superadministrador: alta controlada de negocios, listado global, usuarios, membresías y borradores de campañas.
- Separación multiempresa mediante PostgreSQL RLS y RPCs.

## Servicios que no se simulan como si fueran reales
- Wallet: visualización y puntos de extensión; emisión/actualización real pendiente de certificados e issuer.
- Envío de marketing: editor de borradores; no salen correos desde LP hasta integrar proveedor y cumplimiento.
- Pago recurrente: se muestran precios, no se cobra hasta integrar Stripe y controlar estados de suscripción.
- Detección de ticket real: no existe sin integración TPV; controles de abuso internos no sustituyen conciliación.
- Geocodificación automática: ubicación por coordenadas facilitadas, sin clave de Google Maps.
- Despliegue: no se cambia HOME, dominio ni Contabo.

## Mejoras posteriores
- Integraciones de TPV, conciliación automática y terminales.
- Wallet real con push updates, vencimientos y plantillas por proveedor.
- Automatizaciones de campañas, reputación de dominio, supresiones y coste por envío.
- Subscripciones Stripe, facturación, límites y suspensión por impago.
- Auditoría extendida de cambios administrativos, alertas y métricas de adquisición del directorio.
- Pruebas E2E, CI/CD separado de HOME y copia/restore.
