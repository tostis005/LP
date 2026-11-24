# CRM comercial / DENUE

Primera fase: el CRM se encuentra dentro de Administración → CRM comercial.
No tiene ninguna función de envío ni conecta con el SMTP de registro.

## Piloto Tecate
1. Descargar desde https://www.inegi.org.mx/app/descarga/ el DENUE CSV vigente para Baja California. Seleccionar el programa DENUE y formato CSV. Los archivos pueden venir separados por sector; no usar el catálogo o el diccionario como archivo de establecimientos.
2. Descomprimir localmente; no subir archivos de contactos al repositorio público.
3. En Administración → CRM comercial → Importar y analizar DENUE, seleccionar el CSV y la clave municipal 02003 (Tecate). Vacío procesa todo el archivo. Si pesa más de 40 MB, dividir en CSV completos con su cabecera.
4. Analizar sin guardar. Las cifras se refieren al archivo y filtro, no necesariamente al municipio completo. Importar tras revisar. Repetir con los sectores restantes.
5. Filtrar por México / estado / municipio / localidad / sector. La lista está paginada. La revisión de la compatibilidad individual, vigencia y permiso de comunicación es necesaria; la etiqueta Cualificado no equivale a consentimiento.

Las importaciones conservan estado comercial y notas, deduplican por ID DENUE y distinguen correos únicos de establecimientos. Una dirección excluida se conserva para nuevas importaciones. No se comprueba la existencia del buzón ni se envían correos. La clasificación SCIAN es una hipótesis comercial configurable en lib/server/denue.ts.

## Verificación
- npm run typecheck
- npm run build
- node --experimental-strip-types --test tests/native/denue.mjs (Node 22)
- En entorno de pruebas, aplicar migraciones; verificar que una sesión no administradora recibe 403 y no puede acceder a las tablas por otros endpoints.
- Comprobar reimportación, exclusiones y resultados con un CSV real.

El análisis completo de México requiere los archivos de todos los estados y sectores relevantes. Los informes por importación no se deben sumar sin deduplicar fuentes superpuestas.
