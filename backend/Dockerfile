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
# The repository has pre-existing TS2742 errors caused by declaration: true.
# Declaration output is not needed at runtime, so it is disabled for the image.
RUN pnpm build --declaration false --declarationMap false

# ---- test: run the verification available in the repository ----
# backend/package.json has no test script. The available check is the TypeScript
# type check, using the same declaration override as the build stage.
FROM build AS test
RUN pnpm exec tsc --noEmit --declaration false --declarationMap false

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

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
