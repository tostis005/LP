# Kreyvi: web pública, app y CRM

## Incluido en esta rama
- Inicio público para clientes; antigua web comercial en /para-negocios.
- Arranque PWA por /entrar, protección de la ruta antigua /mi-loyally, pantalla de carga y login visual.
- Carrusel vertical circular con tarjeta completa, botones de navegación y apertura de QR; comprobar iOS después de alta.
- Datos DENUE: colonia/asentamiento, código postal y URL de Instagram solo cuando aparece como web del directorio. Se conserva el estado comercial y los contactos existentes. No se inventan redes sociales.
- Carga inicial para León (11020) y Guadalajara (14039), usando el mismo patrón de archivos 05/2025 del resto de municipios. Confirmar archivos y edición más reciente antes de importar; no se ha ejecutado la descarga.

## Pendiente antes de producción
- Marketing: rol separado de platform_admins; tabla de permisos con ámbitos país/estado/municipio/localidad/colonia; denegar sin ámbitos y permitir múltiples zonas. Aplicar autorización en servidor, RLS y cada endpoint (incluidos correo, exportaciones, estadísticas y mapa), evitar que la caché global de agregados mezcle ámbitos; alta y edición administrativa de usuarios, menú exclusivo CRM. No otorgar permisos de administrador como atajo.
- Mapa de todos los resultados filtrados mediante endpoint acotado y agrupamiento de puntos; sin coordenadas no situar negocios arbitrariamente. Filtros de colonia y país, ficha de Instagram con evidencia, revisión de imports antiguos.
- Verificar inicio de sesión web y PWA instalada iOS/Android, alta y QR, gestos y uso de teclado, tipos y build, migración PostgreSQL, estado de contactos y deduplicación de email. No enviar correos durante importación.
