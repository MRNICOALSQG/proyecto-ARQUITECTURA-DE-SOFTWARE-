# Pruebas del backend

La suite usa exclusivamente APIs incorporadas en Node.js (`node:test` y
`node:assert`) y el compilador TypeScript que ya forma parte del proyecto. No
agrega dependencias de producción ni de desarrollo.

## Herramientas

- `node:test` como runner.
- `node:assert/strict` para aserciones.
- `tsc` (ya presente en `devDependencies`) para compilar las pruebas a
  `.test-dist/`.
- `fetch`/`FormData`/`Blob` nativos de Node 22 para las pruebas HTTP.

## Estructura

```
tests/
  helpers/          utilidades de entorno, servidor, base de datos y HTTP
  unit/             pruebas sin base de datos (servicios, middleware, uploads)
  integration/      pruebas HTTP contra PostgreSQL real (se omiten sin TEST_DATABASE_URL)
```

Las pruebas unitarias aíslan los repositorios o el pool de PostgreSQL con stubs.
Las pruebas de integración usan una base real, ejecutan las migraciones del
proyecto y limpian las tablas antes de empezar. No se presentan los stubs como
pruebas de integración.

## Comandos

Desde `backend/`:

```bash
npm test                 # compila y ejecuta toda la suite disponible
npm run test:unit        # solo pruebas unitarias (sin PostgreSQL)
npm run test:integration # solo integración (requiere TEST_DATABASE_URL)
npm run test:coverage    # suite completa con cobertura y umbrales
npm run typecheck        # tsc --noEmit
npm run build            # compilación canónica con declaraciones
```

`npm test` siempre es ejecutable: si `TEST_DATABASE_URL` no está definida, los
archivos de integración se marcan como omitidos con un motivo visible y el resto
se ejecuta. Para exigir PostgreSQL (por ejemplo en CI), define
`REQUIRE_INTEGRATION=1`: la suite falla al arrancar si falta la URL.

## Base de datos de integración

`TEST_DATABASE_URL` debe apuntar a una base **desechable y aislada**. El guard de
`tests/helpers/db-guard.ts` exige que el nombre termine exactamente en `_test` o
`_ci` y que el host sea `127.0.0.1`, `localhost`, `::1`, `postgres` o `db`.
Rechaza explícitamente `rinne`, `rinne_prod`, `rinne_produccion`, `production`,
`postgres`, hosts remotos y nombres que solo contengan `test`/`ci` como
subcadena. La validación ocurre **antes** de ejecutar migraciones o `TRUNCATE`.

```bash
# PowerShell
$env:TEST_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/rinne_test_ci"
npm test
```

Las pruebas ejecutan `runMigrations` sobre esa base y luego hacen `TRUNCATE` de
las tablas de la aplicación. Nunca uses la base `rinne`, credenciales de
producción ni un volumen persistente compartido.

La suite crea un directorio temporal `rinne-tests-uploads-*` y lo elimina al
terminar, incluso si una prueba falla. Al arrancar también barre directorios
huérfanos con ese prefijo y más de una hora de antigüedad.

### PostgreSQL efímero sin Docker

Si están instalados los binarios de PostgreSQL, se puede levantar un cluster
temporal fuera del repositorio:

```powershell
$pgBin = "C:\Program Files\PostgreSQL\17\bin"
$data = Join-Path $env:TEMP "rinne-pg-test"
$port = 55432
& "$pgBin\initdb.exe" -D $data -U postgres --auth=trust --encoding=UTF8
& "$pgBin\pg_ctl.exe" -D $data -o "-p $port -c listen_addresses=127.0.0.1" -l "$data\server.log" start
& "$pgBin\createdb.exe" -h 127.0.0.1 -p $port -U postgres rinne_local_test
$env:TEST_DATABASE_URL = "postgresql://postgres@127.0.0.1:$port/rinne_local_test"
npm test
& "$pgBin\pg_ctl.exe" -D $data stop
Remove-Item -Recurse -Force $data
```

El script anterior crea un cluster nuevo en `%TEMP%`, no toca el servicio
PostgreSQL del sistema ni sus datos, y lo elimina al terminar.

## Datos y secretos

- Las pruebas no leen `backend/.env`.
- No se usan credenciales reales ni datos personales.
- Los uploads se escriben en un directorio temporal creado por la suite y se
  eliminan al finalizar.
- Los tests no imprimen tokens JWT.
