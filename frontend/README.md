# Frontend de Rin'ne

SPA construida con React 19, TypeScript, Vite, Tailwind CSS, Zustand y Howler.

## Requisitos

- Node.js 22 o superior.
- pnpm 9.15.9 (fijado en `packageManager`). Si Corepack no esta disponible, usa
  `npx pnpm@9.15.9`.

## Instalacion

```bash
pnpm install
```

## Entorno

Copia `.env.example` como `.env` solo si necesitas cambiar los valores por
defecto:

| Variable | Por defecto | Descripcion |
| --- | --- | --- |
| `VITE_API_URL` | `/api` | URL base de la API; se resuelve en tiempo de build |
| `DEV_API_TARGET` | `http://localhost:3001` | Destino del proxy de Vite en desarrollo |

En desarrollo, Vite reenvia `/api` y `/uploads` a `DEV_API_TARGET`. En produccion
el frontend debe servirse detras de un reverse proxy que enrute ambas rutas al
backend.

## Comandos

```bash
pnpm dev      # desarrollo en http://localhost:5173
pnpm build    # tsc -b + vite build
pnpm lint     # ESLint
pnpm preview  # sirve el build de produccion
```

## Estructura

```text
src/api/          Cliente Axios y utilidades de URLs
src/components/   Componentes de interfaz y reproductor
src/pages/        Login y dashboard
src/stores/       Estado global con Zustand
src/assets/       Recursos importados por la aplicacion
public/           Archivos estaticos servidos tal cual
```

## Estado conocido

`pnpm build` falla actualmente en `tsc -b` por cinco imports y variables sin
usar en `Favorites.tsx` y `Player.tsx` (TS6133). Es un problema preexistente y
ajeno a la organizacion de dependencias. Para validar solo el empaquetado:

```bash
pnpm exec vite build
```

Consulta el README raiz para la instalacion completa (base de datos y backend).
