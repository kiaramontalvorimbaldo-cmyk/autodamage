import { describe, expect, it } from 'vitest';
import { AppError, isAppError, toErrorResponse } from './errors';

describe('AppError', () => {
  it('serializa al formato { error: { code, message } }', () => {
    const error = new AppError('NO_ENCONTRADO', 404, 'Recurso no encontrado');
    expect(error.toBody()).toEqual({
      error: { code: 'NO_ENCONTRADO', message: 'Recurso no encontrado' },
    });
  });

  it('incluye detalles cuando se proporcionan', () => {
    const error = new AppError('VALIDACION', 400, 'Datos inválidos', [{ campo: 'email' }]);
    expect(error.toBody()).toEqual({
      error: {
        code: 'VALIDACION',
        message: 'Datos inválidos',
        details: [{ campo: 'email' }],
      },
    });
  });

  it('usa el código como mensaje por defecto', () => {
    const error = new AppError('SIN_PERMISO', 403);
    expect(error.message).toBe('SIN_PERMISO');
    expect(error.toBody().error).toEqual({
      code: 'SIN_PERMISO',
      message: 'SIN_PERMISO',
    });
  });

  it('es detectable con isAppError', () => {
    expect(isAppError(new AppError('X', 500))).toBe(true);
    expect(isAppError(new Error('error normal'))).toBe(false);
    expect(isAppError('string')).toBe(false);
  });

  it('toErrorResponse devuelve JSON con el estado HTTP del AppError', async () => {
    const respuesta = toErrorResponse(new AppError('SIN_PERMISO', 403, 'Prohibido'));
    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toEqual({
      error: { code: 'SIN_PERMISO', message: 'Prohibido' },
    });
  });

  it('toErrorResponse oculta los detalles de errores inesperados', async () => {
    const respuesta = toErrorResponse(new Error('secreto interno'));
    expect(respuesta.status).toBe(500);
    expect(await respuesta.json()).toEqual({
      error: { code: 'ERROR_INTERNO', message: 'Error interno del servidor' },
    });
  });
});
