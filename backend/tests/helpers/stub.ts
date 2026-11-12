import Module from 'module';

/**
 * Sustituye un modulo de CommonJS antes de que sea requerido.
 *
 * Se usa solo en pruebas unitarias que necesitan aislar Express de PostgreSQL
 * (por ejemplo, el health check). Devuelve una funcion para restaurar el cache.
 */
export function stubModule(modulePath: string, exports: unknown): () => void {
  const resolved = require.resolve(modulePath);
  const previous = require.cache[resolved];
  const fakeModule = new Module(resolved);
  fakeModule.filename = resolved;
  fakeModule.loaded = true;
  fakeModule.exports = exports;
  require.cache[resolved] = fakeModule;

  return () => {
    if (previous) {
      require.cache[resolved] = previous;
      return;
    }
    delete require.cache[resolved];
  };
}
