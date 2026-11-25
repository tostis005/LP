# Biblioteca de contactos CRM

Un CSV por ciudad/municipio, con nombre descriptivo (por ejemplo, mx-baja-california-tecate.csv).
Los archivos se incluyen en la imagen de la aplicación, fuera de public/. Solo el administrador puede ver e importar la biblioteca desde el CRM; el despliegue **no ejecuta** importaciones.

Columnas UTF-8: negocio,sector,estado,municipio,localidad,correo_publicado,url_fuente,direccion,id_denue

Cada archivo debe tener un solo municipio y estado de México. El municipio debe existir en el CRM, mediante DENUE. Las altas requieren dirección publicada. El correo y la URL de fuente son obligatorios. No hay máximo de filas; límite de seguridad por fichero: 20 MiB.

IMPORTANTE: este repositorio es público. No incluir datos privados, personales, secretos ni contactos que no estén destinados a publicarse. No incluir contactos sin fuente comprobada. Los ejemplos ficticios deben tener extensión .example, no .csv.
