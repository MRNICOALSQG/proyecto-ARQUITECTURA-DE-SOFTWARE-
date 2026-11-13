# syntax=docker/dockerfile:1

# ---- deps: install every dependency needed to compile the API ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- build: compile TypeScript into dist/ ----
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY src ./src
# Canonical build: TypeScript emits declarations and must pass without flags
# that hide errors (the former TS2742 workaround has been fixed).
RUN pnpm build

# ---- test: lightweight production-source type check ----
# Full unit and PostgreSQL integration tests run in GitHub Actions.
FROM build AS test
RUN pnpm exec tsc --noEmit

# ---- prod-deps: production dependencies only ----
FROM node:22-alpine AS prod-deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ---- prod: minimal runtime image, never runs as root ----
FROM node:22-alpine AS prod
ARG APP_VERSION=development
ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    PORT=3001 \
    UPLOAD_DIR=/data/uploads

WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# El servicio `migrate` ejecuta este archivo. Si falta, la imagen no sirve para
# desplegar el Cambio 10 y el build debe fallar aqui, no en produccion.
RUN test -f /app/dist/migrations/cli.js

# Uploads live outside the application tree and must be writable by `node`.
RUN mkdir -p /data/uploads && chown -R node:node /data/uploads

# El runtime solo ejecuta `node dist/server.js`: npm/npx no se usan y su copia
# incluida en la imagen base arrastra vulnerabilidades HIGH/CRITICAL que Trivy
# bloquea. Se eliminan para reducir superficie de ataque y mantener el gate.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
