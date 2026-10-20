# syntax=docker/dockerfile:1.7
#
# CareerHub production images (multi-stage, Alpine).
#   runner (default) – minimal Next.js standalone server, non-root
#   tools            – slim toolchain for one-off jobs: migrations and demo seed
#
# No secrets are baked in: .dockerignore keeps .env files out of the build
# context and all configuration is supplied at runtime by docker-compose.yml.

ARG NODE_IMAGE=node:24.19.0-alpine

FROM ${NODE_IMAGE} AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
# openssl: required by the Prisma CLI; libc6-compat: glibc shims for native modules.
RUN apk add --no-cache openssl libc6-compat

# ── Dependencies (cached unless package files change) ────────────────────────
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# prisma.config.ts requires DATABASE_URL to be defined; `prisma generate`
# never connects, so a non-secret placeholder is enough at build time.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npm ci --no-audit --no-fund

# ── Build ────────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
ENV NODE_ENV=production NEXT_OUTPUT=standalone
RUN npm run build

# ── Tools: `prisma migrate deploy` and the optional demo seed ────────────────
# Installs only the packages migrations and the seed need, pinned to the exact
# versions in package-lock.json, instead of the full dev toolchain.
FROM base AS tools
COPY package-lock.json ./
RUN node -e "const p=require('./package-lock.json').packages; const v=n=>p['node_modules/'+n].version; \
      const deps=['prisma','@prisma/client','@prisma/adapter-pg','pg','tsx','dotenv']; \
      require('fs').writeFileSync('package.json', JSON.stringify({name:'careerhub-tools',private:true, \
        dependencies:Object.fromEntries(deps.map(d=>[d,v(d)])), \
        allowScripts:{'prisma':true,'@prisma/engines':true,'esbuild':true}}, null, 2))" \
 && rm package-lock.json \
 && npm install --no-audit --no-fund --omit=dev \
 && npm cache clean --force
COPY prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY src/lib/password.ts src/lib/utils.ts ./src/lib/
COPY src/server/storage/local.ts src/server/storage/s3.ts src/server/storage/sigv4.ts src/server/storage/types.ts ./src/server/storage/
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate \
 && mkdir -p /app/storage/uploads && chown -R node:node /app/storage
ENV NODE_ENV=production
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/app/storage/uploads
WORKDIR /app
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# Resume volume mount point, owned by the unprivileged user.
RUN mkdir -p /app/storage/uploads /app/.next/cache && chown -R node:node /app/storage /app/.next/cache
USER node
EXPOSE 3000
VOLUME ["/app/storage/uploads"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
