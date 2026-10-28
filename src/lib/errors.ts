/**
 * Error de aplicación con código legible, estado HTTP y detalles opcionales.
 * Toda la API responde errores en el formato estándar:
 * { "error": { "code", "message", "details"? } }
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, status: number, message?: string, details?: unknown) {
    super(message ?? code);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    if (details !== undefined) {
      this.details = details;
    }
    // Corrige la cadena de prototipos para que `instanceof`
    // funcione también en las subclases (p. ej. AiUnavailableError).
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toBody(): { error: { code: string; message: string; details?: unknown } } {
    if (this.details === undefined) {
      return { error: { code: this.code, message: this.message } };
    }
    return { error: { code: this.code, message: this.message, details: this.details } };
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Convierte cualquier error en una Response con el formato estándar.
 * Los errores inesperados no filtran información interna.
 */
export function toErrorResponse(error: unknown): Response {
  if (isAppError(error)) {
    return Response.json(error.toBody(), { status: error.status });
  }
  console.error('Error interno no controlado:', error);
  return Response.json(
    { error: { code: 'ERROR_INTERNO', message: 'Error interno del servidor' } },
    { status: 500 },
  );
}
