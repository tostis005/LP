#!/usr/bin/env bash
set -euo pipefail
cd /opt/lp
test -f .env.production || { echo "ERROR: falta /opt/lp/.env.production"; exit 1; }
test -f scripts/configure-gmail-smtp.mjs || { echo "ERROR: despliega primero la última versión de Loyally"; exit 1; }

DOCKER=(docker)
COMPOSE=(docker compose)
if ! docker info >/dev/null 2>&1; then
  sudo -n docker info >/dev/null
  DOCKER=(sudo -n docker)
  COMPOSE=(sudo -n docker compose)
fi

# STDIN contiene dos líneas, usuario y contraseña de aplicación.
# No se escriben en logs, argumentos ni archivos temporales.
"${DOCKER[@]}" run --rm -i --network none \
  --mount type=bind,source=/opt/lp/.env.production,target=/loyally/.env.production \
  --mount type=bind,source=/opt/lp/scripts/configure-gmail-smtp.mjs,target=/configure-gmail-smtp.mjs,readonly \
  node:22-bookworm-slim node /configure-gmail-smtp.mjs

"${COMPOSE[@]}" --env-file .env.production up -d --no-deps --force-recreate web
# Confirmar autenticación con Gmail y realizar un único envío a la propia
# dirección configurada. No mostrar contraseñas ni el contenido del mensaje.
"${COMPOSE[@]}" --env-file .env.production exec -T web node -e '
(async()=>{
  const nodemailer=require("nodemailer");
  const transport=nodemailer.createTransport({
    host:process.env.SMTP_HOST,
    port:Number(process.env.SMTP_PORT||465),
    secure:process.env.SMTP_SECURE==="true",
    auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}
  });
  await transport.verify();
  await transport.sendMail({
    from:process.env.SMTP_FROM,
    to:process.env.SMTP_USER,
    subject:"Loyally - prueba de correo configurado",
    text:"El correo de confirmación de cuentas ya puede enviarse desde Loyally."
  });
  console.log("SMTP de Gmail verificado: mensaje de prueba enviado a la cuenta configurada.");
})().catch(error=>{
  // Solo metadatos controlados: nunca incluir mensajes, contraseñas ni el SMTP transcript.
  const codes=["EAUTH","ECONNECTION","ETIMEDOUT","ESOCKET","ENOTFOUND","EENVELOPE","EMESSAGE","MODULE_NOT_FOUND"];
  const code=String(error&&error.code||"OTHER");
  const safeCode=codes.includes(code)?code:"OTHER";
  const n=Number(error&&error.responseCode);
  const responseCode=Number.isInteger(n)&&n>=400&&n<=599?n:"none";
  console.error("ERROR: prueba SMTP fallida. Tipo="+safeCode+"; respuestaSMTP="+responseCode+".");
  process.exit(1);
});
'
echo "Gmail SMTP guardado y verificado en Contabo."

