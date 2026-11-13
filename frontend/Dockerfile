# syntax=docker/dockerfile:1

# ---- build: install dependencies and bundle the SPA ----
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Canonical build: `tsc -b` type-checks the SPA and Vite emits dist/ for Nginx.
RUN pnpm build

# ---- prod: static SPA served by Nginx ----
FROM nginx:alpine AS prod
# nginx:alpine incluye libxslt 1.1.43-r3, con tres CVE HIGH corregidos en
# 1.1.43-r4. Se actualiza el paquete para que el gate Trivy HIGH/CRITICAL pase.
RUN apk upgrade --no-cache libxslt
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
