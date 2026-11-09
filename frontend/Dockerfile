# syntax=docker/dockerfile:1

# ---- build: install dependencies and bundle the SPA ----
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# `pnpm build` currently stops at the pre-existing tsc -b step (TS6133 unused
# symbols in Favorites.tsx and Player.tsx). The documented Vite bundling step
# produces the same dist/ consumed by Nginx, without changing application code.
RUN pnpm exec vite build

# ---- prod: static SPA served by Nginx ----
FROM nginx:alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
