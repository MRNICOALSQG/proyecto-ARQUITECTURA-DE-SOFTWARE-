# Rin'ne

Plataforma de streaming de musica con biblioteca personal, playlists, favoritos y
personalizacion visual.

## Tecnologias

- **Frontend:** React, Vite, TypeScript, Tailwind CSS, Zustand y Howler.
- **Backend:** Node.js 22, Express, TypeScript, Zod, Passport y JWT.
- **Base de datos:** PostgreSQL 15.
- **Infraestructura:** Docker, Docker Compose y Nginx como reverse proxy.

## Estructura

```text
backend/                  API REST con Express, TypeScript y PostgreSQL
database/                 Esquema inicial (init.sql) y Compose historico de la base
frontend/                 SPA con React, Vite, Tailwind CSS, Zustand y Howler
compose.yml               Stack completo para local/staging (db + api + web)
compose.prod.yml          Stack de produccion con imagenes de GHCR
.env.example              Variables de entorno del stack de Compose
rinne-dashboard-preview/  Prototipo estatico de diseno (no forma parte del build)
```

`backend/` y `frontend/` son proyectos independientes: cada uno tiene su propio
`package.json` y `pnpm-lock.yaml`. No hay workspace raiz.

## Requisitos previos

- Docker Desktop o Docker Engine con el plugin Docker Compose v2.
- Puertos libres: `8080` para la aplicacion web.
- Opcional para desarrollo sin Docker:
  - Node.js 22 o superior.
  - pnpm 9.15.9. La version esta fijada en el campo `packageManager` de cada
    `package.json`. Si Corepack no esta disponible, usa `npx pnpm@9.15.9`.

## Inicio rapido con Docker Compose

1. Crea el archivo de entorno a partir del ejemplo:

   ```bash
   cp .env.example .env
   ```

2. Edita `.env` y cambia como minimo `DB_PASSWORD` y `JWT_SECRET`.
   `DB_PASSWORD` debe ser URL-safe (solo `[A-Za-z0-9._~-]`) y `JWT_SECRET` debe
   tener al menos 32 caracteres. No uses los valores de ejemplo en un entorno
   real.

3. Construye y levanta los tres servicios:

   ```bash
   docker compose up --build -d
   ```

4. Abre la aplicacion en `http://localhost:8080`.

5. Consulta el estado y los logs:

   ```bash
   docker compose ps
   docker compose logs -f
   ```

6. Deten los servicios sin borrar los datos:

   ```bash
   docker compose down
   ```

## Servicios y red

| Servicio | Imagen / build | Acceso | Funcion |
| --- | --- | --- | --- |
| `db` | `postgres:15-alpine` | Solo red interna, puerto `5432` | PostgreSQL 15 |
| `api` | Build de `backend/` | Solo red interna, puerto `3001` | API REST y archivos |
| `web` | Build de `frontend/` | Host `8080` -> contenedor `80` | Nginx: SPA y reverse proxy |

La aplicacion se sirve desde Nginx:

- `http://localhost:8080/` entrega la SPA de React.
- `http://localhost:8080/api/...` se reenvia a `api:3001` conservando el
  prefijo `/api/`.
- `http://localhost:8080/uploads/...` se reenvia a `api:3001` para servir los
  archivos subidos.

Ni PostgreSQL ni la API publican puertos al host. La base de datos solo es
accesible desde la red interna de Compose y la API solo se alcanza a traves de
Nginx. Nginx usa el DNS interno de Docker con `resolver 127.0.0.11` y una
variable en `proxy_pass` para volver a resolver el servicio `api` si el
contenedor se recrea.

El arranque respeta las dependencias:

1. `db` inicia y su healthcheck ejecuta `pg_isready`.
2. `api` espera a que `db` este saludable y valida `/api/health`.
3. `web` espera a que `api` este saludable antes de arrancar.

## Variables de entorno

El archivo `.env` de la raiz alimenta a Docker Compose y se pasa a la API con
`env_file: .env`. No se versiona.

| Variable | Por defecto | Descripcion |
| --- | --- | --- |
| `POSTGRES_DB` | `rinne` | Nombre de la base de datos |
| `POSTGRES_USER` | `rinne_user` | Usuario de PostgreSQL |
| `DB_PASSWORD` | - | Contrasena de PostgreSQL; obligatoria y URL-safe |
| `JWT_SECRET` | - | Secreto de firma JWT; minimo 32 caracteres |
| `JWT_EXPIRES_IN` | `24h` | Duracion del token (`15m`, `24h`, `7d`) |
| `FRONTEND_URL` | `http://localhost:8080` | Origen permitido por CORS |
| `MAX_FILE_SIZE` | `52428800` | Tamano maximo por audio, en bytes (50 MB) |
| `DB_POOL_MAX` | `20` | Conexiones maximas del pool |
| `DB_IDLE_TIMEOUT_MS` | `30000` | Tiempo de inactividad del pool |
| `DB_CONNECTION_TIMEOUT_MS` | `2000` | Timeout de conexion |
| `TAG` | - | Etiqueta obligatoria de las imagenes de GHCR en produccion |

Compose construye `DATABASE_URL` automaticamente con el host interno `db`:

```text
postgresql://${POSTGRES_USER}:${DB_PASSWORD}@db:5432/${POSTGRES_DB}
```

`DB_PASSWORD` se usa dos veces: como contrasena real de PostgreSQL
(`POSTGRES_PASSWORD`) y dentro de `DATABASE_URL`. Por eso debe ser **URL-safe**:
solo `[A-Za-z0-9._~-]`. Evita `@`, `:`, `/`, `?`, `#`, `%` y espacios.

No codifiques caracteres a mano (por ejemplo `@` como `%40` o `:` como `%3A`).
El parser de `DATABASE_URL` en la API decodifica esas secuencias, de modo que la
contrasena con la que se conecta no coincidiria con la que inicializo
PostgreSQL. Usa directamente una contrasena que ya cumpla el conjunto permitido.

El healthcheck de `db` verifica este requisito: si `DB_PASSWORD` contiene
caracteres fuera del conjunto permitido, la base queda `unhealthy` y la API no
arranca, en lugar de fallar mas tarde con un error de autenticacion.

No es necesario definir `DATABASE_URL` en `.env`.

`UPLOAD_DIR` se fija a `/data/uploads` dentro del contenedor y `NODE_ENV` a
`production`; no deben cambiarse en el stack de Compose.

## Volumenes y persistencia

El stack declara dos volumenes nombrados:

| Volumen | Punto de montaje | Contenido |
| --- | --- | --- |
| `pgdata` | `/var/lib/postgresql/data` | Datos de PostgreSQL |
| `uploads` | `/data/uploads` | Imagenes y canciones subidas |

Ambos persisten al detener y eliminar los contenedores con `docker compose down`.
Al volver a ejecutar `docker compose up`, los datos siguen disponibles.

> **Advertencia:** `docker compose down -v` elimina tambien los volumenes y,
> por tanto, todos los datos de PostgreSQL y los archivos subidos. Es una accion
> destructiva e irreversible.

### Continuidad desde el Compose historico

El archivo `database/docker-compose.yml` es anterior al stack raiz y **no
comparte sus volumenes**:

| Stack | Proyecto Compose | Volumen de PostgreSQL | Puerto del host |
| --- | --- | --- | --- |
| `database/docker-compose.yml` | `database` | `database_rinne_pgdata` | `5433` |
| `compose.yml` / `compose.prod.yml` | `rinne` | `rinne_pgdata` | ninguno |

Los datos **no se trasladan automaticamente**. Al levantar el stack raiz se crea
un volumen `rinne_pgdata` nuevo y `init.sql` inicializa un esquema vacio. El
volumen antiguo `database_rinne_pgdata` sigue existiendo, pero no se monta en el
stack nuevo. Lo mismo ocurre con los archivos subidos: el stack raiz usa el
volumen `uploads`, mientras que el desarrollo antiguo los guardaba en
`backend/uploads/`.

> **Advertencia:** haz una copia de seguridad y verifica que el respaldo se puede
> restaurar antes de migrar. No ejecutes `docker compose down -v` en ninguno de
> los dos stacks hasta confirmar que los datos estan en el stack nuevo.

Procedimiento documentado (no ejecutado durante la revision del Cambio 13).
Ajusta credenciales y nombres de contenedor a tu entorno:

1. Exporta la base antigua desde el contenedor `rinne-postgres`:

   ```bash
   docker exec rinne-postgres pg_dump -U rinne_user -Fc -d rinne -f /tmp/rinne_backup.dump
   docker cp rinne-postgres:/tmp/rinne_backup.dump ./rinne_backup.dump
   ```

2. Levanta solo la base del stack nuevo (crea `rinne_pgdata` si no existe):

   ```bash
   docker compose up -d db
   ```

3. Restaura el respaldo sobre el esquema inicial. `--clean --if-exists`
   reemplaza las tablas vacias creadas por `init.sql`:

   ```bash
   docker cp ./rinne_backup.dump rinne-db-1:/tmp/rinne_backup.dump
   docker compose exec -T db pg_restore --clean --if-exists --no-owner -U rinne_user -d rinne /tmp/rinne_backup.dump
   ```

   Ejecuta este paso solo sobre un stack nuevo o vacio. Si el stack nuevo ya
   tiene datos, detente y revisa el respaldo antes de continuar.

4. Migra los archivos subidos desde `backend/uploads/` al volumen `uploads`:

   ```bash
   docker compose up -d api
   docker cp backend/uploads/. rinne-api-1:/data/uploads/
   ```

5. Verifica el estado y los datos antes de retirar el stack antiguo:

   ```bash
   docker compose ps
   curl http://localhost:8080/api/health
   ```

6. Cuando la verificacion sea correcta, apaga el stack antiguo **sin** borrar su
   volumen, para conservar `database_rinne_pgdata` como respaldo:

   ```bash
   docker compose -f database/docker-compose.yml down
   ```

## Produccion con `compose.prod.yml`

`compose.prod.yml` usa las imagenes publicadas en GHCR en lugar de construir
localmente:

```text
ghcr.io/mrnicolasqg/proyecto-arquitectura-de-software--api:${TAG}
ghcr.io/mrnicolasqg/proyecto-arquitectura-de-software--web:${TAG}
```

Los nombres de GHCR deben ir en minusculas. El repositorio termina en guion, por
eso el nombre de la imagen contiene `--api` / `--web`.

Mantiene la misma estructura de servicios, red y volumenes que `compose.yml`,
PostgreSQL 15, politicas `restart: unless-stopped` y logging con rotacion
(`max-size: 10m`, `max-file: 3`). No contiene secretos: toma las variables de
`.env`.

Ambos archivos comparten el proyecto `rinne` y los volumenes `pgdata` y
`uploads`. En un mismo host ejecuta una configuracion u otra, no las dos a la
vez.

`TAG` es obligatoria. Sin ella, `docker compose -f compose.prod.yml` falla a
proposito en lugar de desplegar `latest`:

```bash
# Selecciona la version publicada y descarga las imagenes
TAG=v1.0.0 docker compose -f compose.prod.yml pull

# Levanta el stack
TAG=v1.0.0 docker compose -f compose.prod.yml up -d

# Estado y logs
docker compose -f compose.prod.yml ps
docker compose -f compose.prod.yml logs -f
```

No uses `TAG=latest` en produccion: la etiqueta debe identificar la version que
el pipeline publico para ese despliegue.

El pipeline de GitHub Actions (Cambio 14, pendiente) sera el encargado de
publicar esas imagenes en GHCR con la etiqueta correspondiente.

## Desarrollo sin Docker

Para trabajar con recarga automatica en local:

1. Crea los archivos de entorno de cada subproyecto:

   ```bash
   cp database/.env.example database/.env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

   Ajusta como minimo `POSTGRES_PASSWORD`, `DATABASE_URL` y `JWT_SECRET`.
   `JWT_SECRET` debe tener al menos 32 caracteres.

2. Levanta solo PostgreSQL:

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

### Variables por subproyecto

`backend/.env`:

| Variable | Por defecto | Descripcion |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test` o `production` |
| `APP_VERSION` | `development` | Version reportada por `/api/health` |
| `PORT` | `3001` | Puerto de la API |
| `FRONTEND_URL` | `http://localhost:5173` | Origen permitido por CORS |
| `DATABASE_URL` | - | URL `postgresql://...` de la base |
| `JWT_SECRET` | - | Secreto de firma, minimo 32 caracteres |
| `JWT_EXPIRES_IN` | `24h` | Duracion del token |
| `UPLOAD_DIR` | `./uploads` | Directorio de archivos subidos |
| `MAX_FILE_SIZE` | `52428800` | Tamano maximo por audio, en bytes |
| `DB_POOL_MAX` | `20` | Conexiones maximas del pool |
| `DB_IDLE_TIMEOUT_MS` | `30000` | Tiempo de inactividad del pool |
| `DB_CONNECTION_TIMEOUT_MS` | `2000` | Timeout de conexion |

`database/.env`:

| Variable | Por defecto | Descripcion |
| --- | --- | --- |
| `POSTGRES_DB` | `rinne` | Nombre de la base |
| `POSTGRES_USER` | `rinne_user` | Usuario de PostgreSQL |
| `POSTGRES_PASSWORD` | - | Contrasena obligatoria |
| `POSTGRES_PORT` | `5433` | Puerto publicado en el host |

`frontend/.env`:

| Variable | Por defecto | Descripcion |
| --- | --- | --- |
| `VITE_API_URL` | `/api` | URL base de la API; se resuelve en tiempo de build |
| `DEV_API_TARGET` | `http://localhost:3001` | Destino del proxy de Vite en desarrollo |

En desarrollo, Vite reenvia `/api` y `/uploads` a `DEV_API_TARGET`. En el stack
de Compose esa funcion la cumple Nginx, que reenvia ambas rutas a `api:3001`.

## Comandos

### Backend

```bash
pnpm dev      # ts-node-dev con recarga automatica
pnpm build    # compila TypeScript a dist/
pnpm start    # ejecuta dist/server.js
```

### Frontend

```bash
pnpm dev      # servidor de desarrollo en el puerto 5173
pnpm build    # comprobacion de tipos y build de produccion
pnpm lint     # ESLint
pnpm preview  # sirve el build de produccion
```

### Pruebas y verificaciones

No existe una suite de pruebas automatizadas en el repositorio. Las
verificaciones disponibles son:

```bash
# Backend: typecheck (la etapa `test` del Dockerfile ejecuta este comando)
cd backend
pnpm exec tsc --noEmit --declaration false --declarationMap false

# Frontend: empaquetado de produccion
cd frontend
pnpm exec vite build
```

Para validar las imagenes y el stack:

```bash
docker build --target test -t rinne-api:test backend
docker build -t rinne-web:test frontend
docker compose config
docker compose ps
```

## Migraciones y base de datos

El esquema vive en `database/init.sql` y crea las tablas, indices, el trigger de
preferencias y la extension `pgcrypto`. PostgreSQL lo ejecuta **solo** cuando el
volumen `pgdata` esta vacio (primer arranque).

El sistema de migraciones incrementales corresponde al Cambio 10, que **aun no
esta implementado**. Por tanto, hoy no existe un comando de migraciones como
`pnpm migrate`; para aplicar cambios de esquema hay que hacerlo manualmente o
recrear la base desde cero.

Para reiniciar la base desde cero (accion destructiva, borra tambien los
archivos subidos):

```bash
docker compose down -v
docker compose up --build -d
```

## API y archivos

- Salud: `GET /api/health` devuelve el estado de la base de datos y la version
  de la API.
- Las imagenes subidas se devuelven como rutas relativas (`/uploads/images/...`).
- El streaming usa `GET /api/songs/:id/stream?token=...` con soporte de `Range`
  y respuestas `206`.
- No versiones archivos `.env` ni el contenido de `backend/uploads/`.

## Estado conocido de las comprobaciones

Los siguientes fallos son preexistentes y no estan relacionados con la
organizacion de dependencias ni con Docker Compose:

- `frontend`: `pnpm build` falla en `tsc -b` por cinco variables e imports sin
  usar en `Favorites.tsx` y `Player.tsx` (TS6133). El empaquetado puede validarse
  con `pnpm exec vite build`.
- `backend`: `pnpm build` falla con seis errores TS2742 porque
  `declaration: true` no puede resolver tipos de Express bajo pnpm. La
  compilacion puede validarse con
  `pnpm exec tsc --declaration false --declarationMap false`.

## Seguridad

- No versiones `.env`; solo `.env.example`.
- Cambia `DB_PASSWORD` (URL-safe) y `JWT_SECRET` antes de desplegar.
- Define `TAG` explicitamente en produccion; no uses `latest`.
- PostgreSQL y la API no se publican al host en el stack de Compose.
- `docker compose down -v` elimina los datos de forma irreversible.
