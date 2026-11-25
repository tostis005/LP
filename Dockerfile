# LP / Next.js y PostgreSQL nativo. Dos imágenes: migración y aplicación.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

FROM deps AS migrator
WORKDIR /app
COPY db/migrations ./db/migrations
COPY supabase/migrations ./supabase/migrations
COPY scripts ./scripts
COPY lib/server/denue.ts ./lib/server/denue.ts
CMD ["node", "scripts/migrate.mjs"]

FROM deps AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
# Comprobar en la imagen (no solo en el checkout) que se incluye la portada publica.
RUN node -e 'const fs=require("fs"),s=fs.readFileSync("lib/landing-copy.ts","utf8"),home=fs.readFileSync("app/page.tsx","utf8");const es=s.includes("Tarjetas de fidelización"),en=s.includes("Digital loyalty cards"),present=home.includes("LandingHome");console.log("Docker bilingual homepage:",es,en,present);if(!es||!en||!present)process.exit(1)'
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
RUN mkdir -p public && npm run build && node scripts/verify-kreyv-brand-assets.mjs
RUN node -e 'const fs=require("fs"),s=fs.readFileSync(".next/server/app/page.js","utf8");console.log("Docker build compiled homepage chunk:",s.includes("Tarjetas de fidelización"),"rootHTML:",fs.existsSync(".next/server/app/index.html"));'

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates unzip && rm -rf /var/lib/apt/lists/*
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/crm-imports ./crm-imports
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
CMD ["node", "server.js"]