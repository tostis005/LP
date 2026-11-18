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

## Aclaración de primera entrega
- Alta por enlace propio de negocio (/unirse/[slug]) aunque el negocio no figure en mapa.
- La experiencia mobile tiene un manifiesto web; funcionamiento offline y notificaciones push quedan para otra fase.
- El control de RGPD deberá completarse antes del lanzamiento con textos legales, exportación/supresión de datos y acuerdos con proveedores.

## Superadministración ampliada
El panel permite inspeccionar cada negocio (clientes, personal, operaciones, locales y modalidad), suspender/reactivar un negocio y consultar las tarjetas de cada usuario en el ecosistema. Son operaciones protegidas por RLS y permisos de administrador.

## Controles adicionales (007)
- Límite diario configurable por empleado y negocio; referencia de ticket obligatoria opcional.
- Reversión auditable por responsable (máximo 72 horas) y superadmin, sin borrar movimientos.
- Una operación original solo se puede revertir una vez. La devolución respeta el saldo mínimo 0.
- Resumen de actividad por empleado en informes. El límite no verifica automáticamente tickets reales: para eso hará falta TPV.

## Facturación preparatoria
Incluida migración de suscripción por negocio con período de prueba, acceso exclusivo de propietario, Checkout, portal de Stripe y eventos idempotentes. No se hacen cobros sin credenciales y no se bloquean negocios por pago hasta activar `billing_enforced` después de las pruebas.

## Captación y solicitudes
Landing pública y formulario accesible; tabla con RLS y limitación de duplicados; panel de solicitudes, estado y conversión manual (negocio + invitación). Pendiente envío transaccional de aviso y protección anti-bot adicional.
