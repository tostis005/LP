# Identidad Kreyv (fase 1)

Implementación reversible de la propuesta de `entrega-marca-app.zip` sobre Loyally/LP.

- Nombre visible: **Kreyv**. Las rutas internas antiguas (incluida `/mi-loyally`) se conservan para no romper enlaces y accesos.
- Tema predeterminado: `vino-mostaza`. La alternativa `tinta-maiz` ya existe.
- Para probar la otra paleta, cambia **solo** `BRAND_THEME` en `lib/brand.ts` a `"tinta-maiz"`. Los cuatro logotipos se adaptan al tema y al fondo.
- Tipografía: **Bricolage Grotesque** en títulos y **Figtree** en textos. Tokens CSS en `app/brand-tokens.css`.
- Nuevo símbolo de app en `public/icon.svg`, `icon-192.png`, `icon-512.png` y `apple-touch-icon.png`.
- Las tarjetas de los negocios conservan sus colores, sellos, logotipos y recompensas propios. No hay cambios de base de datos ni de lógica de fidelización.

## Dar marcha atrás

La implementación se encuentra en la rama `feat/kreyv-brand-phase1-20261120` sobre `main`. Si no se ha fusionado, basta con cerrar la PR. Si ya se ha fusionado, revertir los commits de esta rama mediante GitHub; no se ha modificado el esquema ni los datos. Para probar sin desplegar, revisar la PR y ejecutar su CI.

## Pendientes para decidir (fase 2)

1. **12 iconos tipo sello** del ZIP (buscar, cerca, avisos, café, pan, tacos, bebida, favorito, compartir, regalo, mi QR, premio): no sustituidos. Comparar con los iconos de línea conceptuales ya aprobados y ampliar el set si se adopta.
2. **Marcadores de mapa** con estrella llena/vacía para tarjeta adquirida/no adquirida: propuesta funcional, sin implementar.
3. **Reglas de mensajes por negocio, progreso y recompensa** y copies comerciales: pendientes de decisión editorial; no se cambian textos funcionales más allá de la marca.
4. **Variante de logotipo Kreyv con lupa sobre “ey”**: incluida en el ZIP, pero no seleccionada. Se usa la variante “pegada”.
5. **Exportación de tokens a apps nativas, JSON y Tailwind**: no requerida en el stack actual Next.js/CSS; CSS integrados. No se introduce Tailwind solo para usar el kit.
6. **Logotipos finales convertidos a curvas y refinados**: el kit lo recomienda antes de hacer pública la marca definitiva.

Nota: una instalación PWA existente puede necesitar reinstalación o actualización de icono por la caché del sistema operativo.

## Galería de iconos rellenos (fase 2)

- La colección aprobada de **40 pictogramas monocolor** se ha convertido a vectores en `lib/kreyv-icon-paths.ts`. Se dibujan como SVG con un único `currentColor`; el color y el tamaño pueden ajustarse sin alterar el arte.
- El componente `KreyvIcon` muestra los 16 iconos de navegación. Los 24 iconos de categorías también se ofrecen en el selector de sellos del negocio mediante `StampMark`.
- Los sellos antiguos guardados en base de datos mantienen compatibilidad a través de `resolveStampIcon`; no se altera ninguna tarjeta existente.
- En el mapa, **estrella rellena** significa que el usuario dispone de tarjeta de ese negocio y **estrella de contorno** que aún no dispone de ella. El estado utiliza `loyalty_memberships`, ya consultado por la página Descubrir; no se calcula por categoría ni por la preferencia del sello.
- Se añade una leyenda sobre el mapa y el estado de cada negocio en el popup. Cada establecimiento del mismo negocio recibe el mismo estado de posesión.

## Pulido de la home (20 noviembre 2026)

- Portada unificada para español e inglés: bloques visualmente diferenciados (hero crema, sectores blancos, instalación mostaza suave, beneficios blancos, proceso vino oscuro, personalización marfil y CTA independiente).
- Los iconos de la home se renderizan en SVG relleno y monocolor, con tamaños ópticos y rejilla uniformes, incluida la vista previa de instalación de la PWA.
- Cafetería: taza rellena revisada. Barbería: bigote y barba inequívocos, sin silueta de cabeza. Floristería: flor en maceta diferenciada del loto de spa.
- Añadido `floristeria` como ID de categoría y sello, con compatibilidad para tarjetas anteriores `flower`. La migración `270_floristeria_distinct_icon.sql` amplía el listado de iconos permitidos sin modificar registros existentes.
- Pruebas de regresión específicas en `tests/demo/home-polish.mjs`, además de CI de PostgreSQL, Next.js y Docker.
