export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
  headers: Headers;
  text: string;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
}

function buildHeaders(options: RequestOptions): Headers {
  const headers = new Headers(options.headers);

  if (options.body !== undefined) {
    headers.set('content-type', 'application/json');
  }
  if (options.token) {
    headers.set('authorization', `Bearer ${options.token}`);
  }

  return headers;
}

/** Envia una peticion JSON y devuelve estado, cuerpo parseado y texto crudo. */
export async function requestJson<T = unknown>(
  baseUrl: string,
  path: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: buildHeaders(options),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  let body: unknown = null;

  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return {
    status: response.status,
    body: body as T,
    headers: response.headers,
    text,
  };
}

export function bearer(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}
