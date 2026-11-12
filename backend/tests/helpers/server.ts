import { once } from 'events';
import type { AddressInfo } from 'net';
import type { Express } from 'express';

export interface TestServer {
  baseUrl: string;
  close(): Promise<void>;
}

/**
 * Arranca la aplicacion en un puerto efimero y devuelve la URL base. El cierre
 * espera a que el servidor termine para no dejar handles abiertos entre archivos.
 */
export async function startTestServer(app: Express): Promise<TestServer> {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
