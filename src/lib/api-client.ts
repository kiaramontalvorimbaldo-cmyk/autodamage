/**
 * Cliente HTTP tipado para la API.
 * Los errores de la API llegan en formato { error: { code, message, details? } }.
 */

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type RequestInitConBody = Omit<RequestInit, 'body'> & { body?: unknown };

export async function apiFetch<T>(path: string, init: RequestInitConBody = {}): Promise<T> {
  const encabezados: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };

  let cuerpo: BodyInit | undefined;
  if (init.body !== undefined && !(init.body instanceof FormData)) {
    encabezados['Content-Type'] = 'application/json';
    cuerpo = JSON.stringify(init.body);
  } else if (init.body instanceof FormData) {
    cuerpo = init.body;
  }

  const respuesta = await fetch(path, { ...init, headers: encabezados, body: cuerpo });

  if (!respuesta.ok) {
    const cuerpoError = (await respuesta.json().catch(() => null)) as {
      error?: { code?: string; message?: string; details?: unknown };
    } | null;
    const error = cuerpoError?.error;
    throw new ApiError(
      error?.code ?? 'ERROR_INTERNO',
      respuesta.status,
      error?.message ?? 'Error inesperado del servidor',
      error?.details,
    );
  }

  if (respuesta.status === 204) {
    return undefined as T;
  }
  return (await respuesta.json()) as T;
}
