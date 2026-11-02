# Rin'ne

Plataforma de streaming de musica con biblioteca personal, playlists, favoritos y personalizacion visual.

## Estructura

```text
backend/                  API REST con Express, TypeScript y PostgreSQL
database/                 Docker Compose, variables y esquema inicial (init.sql)
frontend/                 SPA con React, Vite, Tailwind CSS, Zustand y Howler
rinne-dashboard-preview/  Prototipo estatico de diseno (no forma parte del build)
```

`backend/` y `frontend/` son proyectos independientes: cada uno tiene su propio
`package.json` y `pnpm-lock.yaml`. No hay workspace raiz.

## Requisitos

- Node.js 22 o superior.
- pnpm 9.15.9. La version esta fijada en el campo `packageManager` de cada
  `package.json`. Si Corepack no esta disponible, usa `npx pnpm@9.15.9`.
- Docker con Docker Compose para la base de datos.

## Puesta en marcha

1. Crea los archivos de entorno a partir de los ejemplos:

   ```bash
   cp database/.env.example database/.env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

   Ajusta como minimo `POSTGRES_PASSWORD`, `DATABASE_URL` y `JWT_SECRET`.
   `JWT_SECRET` debe tener al menos 32 caracteres.

2. Levanta PostgreSQL:

   ```bash
   cd database
   docker compose up -d
   ```

3. Instala dependencias y arranca cada proyecto:

   ```bash
   cd backend
   pnpm install
   pnpm dev

   cd ../frontend
   pnpm install
   pnpm dev
   ```

4. Abre `http://localhost:5173`. La API escucha en `http://localhost:3001`.

## Variables de entorno

### backend/.env

| Variable | Por defecto | Descripcion |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test` o `production` |
| `PORT` | `3001` | Puerto de la API |
| `FRONTEND_URL` | `http://localhost:5173` | Origen permitido por CORS |
| `DATABASE_URL` | - | URL `postgresql://...` de la base |
| `JWT_SECRET` | - | Secreto de firma, minimo 32 caracteres |
| `JWT_EXPIRES_IN` | `24h` | Duracion del token (`15m`, `24h`, `7d`) |
| `UPLOAD_DIR` | `./uploads` | Directorio de archivos subidos |
| `MAX_FILE_SIZE` | `52428800` | Tamano maximo por audio, en bytes |
| `DB_POOL_MAX` | `20` | Conexiones maximas del pool |
| `DB_IDLE_TIMEOUT_MS` | `30000` | Tiempo de inactividad del pool |
| `DB_CONNECTION_TIMEOUT_MS` | `2000` | Timeout de conexion |

### database/.env

| Variable | Por defecto | Descripcion |
| --- | --- | --- |
| `POSTGRES_DB` | `rinne` | Nombre de la base |
| `POSTGRES_USER` | `rinne_user` | Usuario de PostgreSQL |
| `POSTGRES_PASSWORD` | - | Contrasena obligatoria |
| `POSTGRES_PORT` | `5433` | Puerto publicado en el host |

### frontend/.env

| Variable | Por defecto | Descripcion |
| --- | --- | --- |
| `VITE_API_URL` | `/api` | URL base de la API; se resuelve en tiempo de build |
| `DEV_API_TARGET` | `http://localhost:3001` | Destino del proxy de Vite en desarrollo |

En desarrollo, Vite reenvia `/api` y `/uploads` a `DEV_API_TARGET`. En produccion
el frontend debe servirse detras de un reverse proxy que enrute ambas rutas al
backend; el proxy de Vite no sustituye esa configuracion.

## Comandos

### Backend

```bash
pnpm dev      # ts-node-dev con recarga automatica
pnpm build    # compila TypeScript a dist/
pnpm start    # ejecuta dist/index.js
```

### Frontend

```bash
pnpm dev      # servidor de desarrollo en el puerto 5173
pnpm build    # comprobacion de tipos y build de produccion
pnpm lint     # ESLint
pnpm preview  # sirve el build de produccion
```

## API y archivos

- Salud: `GET /api/health`.
- Las imagenes subidas se devuelven como rutas relativas (`/uploads/images/...`).
- El streaming usa `GET /api/songs/:id/stream?token=...` con soporte de `Range`
  y respuestas `206`.
- No versiones archivos `.env` ni el contenido de `backend/uploads/`.

## Base de datos

`database/init.sql` crea el esquema completo y se ejecuta solo cuando el volumen
de PostgreSQL esta vacio. Para reiniciar desde cero (accion destructiva):

```bash
cd database
docker compose down -v
docker compose up -d
```

## Estado conocido de las comprobaciones

Los siguientes fallos son preexistentes y no estan relacionados con la
organizacion de dependencias:

- `frontend`: `pnpm build` falla en `tsc -b` por cinco variables e imports sin
  usar en `Favorites.tsx` y `Player.tsx` (TS6133). El empaquetado puede validarse
  con `pnpm exec vite build`.
- `backend`: `pnpm build` falla con siete errores TS2742 porque
  `declaration: true` no puede resolver tipos de Express bajo pnpm. La
  compilacion puede validarse con
  `pnpm exec tsc --declaration false --declarationMap false`.
