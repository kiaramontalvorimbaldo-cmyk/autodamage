import { describe, expect, it } from 'vitest';
import {
  MENSAJE_GENERICO,
  mensajeDeCodigo,
  mensajeDeError,
} from './user-messages';
import { ApiError } from './api-client';

const CODIGOS_CONOCIDOS = [
  'NO_AUTENTICADO',
  'SIN_PERMISO',
  'NO_AUTORIZADO',
  'VEHICULO_DUPLICADO',
  'VEHICULO_CON_SINIESTROS',
  'VEHICULO_NO_ENCONTRADO',
  'VEHICULO_AJENO',
  'ARCHIVO_NO_EN_VIVO',
  'IA_NO_DISPONIBLE',
  'CUOTA_AGOTADA',
  'SIN_PIEZAS_VALIDAS',
  'BAJA_CONFIANZA',
  'SINIESTRO_NO_ENCONTRADO',
  'ESTADO_INVALIDO',
  'RECHAZO_AUTOMATICO_PROHIBIDO',
  'VALIDACION_ERROR',
  'SIN_TALLERES_DISPONIBLES',
  'SIN_CONEXION',
  'TIEMPO_ESPIRADO',
  'DEMASIADOS_INTENTOS',
];

const SIN_JERGA = /\bAPI\b|endpoint|Supabase|base de datos/i;

describe('mensajeDeCodigo', () => {
  it.each(CODIGOS_CONOCIDOS)('devuelve un texto en español para %s', (codigo) => {
    const mensaje = mensajeDeCodigo(codigo);
    expect(mensaje).toBeTruthy();
    expect(mensaje).not.toBe(MENSAJE_GENERICO);
    expect(mensaje).toMatch(/[a-záéíóúñ]/i);
  });

  it('devuelve el mensaje genérico para un código desconocido', () => {
    expect(mensajeDeCodigo('CODIGO_INVENTADO_XYZ')).toBe(MENSAJE_GENERICO);
  });

  it('detalla el campo cuando el conflicto es de vehículo', () => {
    expect(mensajeDeCodigo('VEHICULO_DUPLICADO', 'matricula')).toBe(
      'Ya existe un vehículo registrado con esa matrícula.',
    );
    expect(mensajeDeCodigo('VEHICULO_DUPLICADO', 'numero_poliza')).toBe(
      'Ya existe un vehículo registrado con ese número de póliza.',
    );
  });

  it('ignora un campo desconocido en el conflicto', () => {
    expect(mensajeDeCodigo('VEHICULO_DUPLICADO', 'otro')).toBe(
      'Ya existe un vehículo registrado con esos datos.',
    );
  });

  it('ningún texto usa jerga técnica', () => {
    const mensajes = [
      ...CODIGOS_CONOCIDOS.map((codigo) => mensajeDeCodigo(codigo)),
      MENSAJE_GENERICO,
    ];
    for (const mensaje of mensajes) {
      expect(mensaje).not.toMatch(SIN_JERGA);
    }
  });
});

describe('mensajeDeError', () => {
  it('traduce un ApiError usando su código y detalles', () => {
    const error = new ApiError('VEHICULO_DUPLICADO', 409, 'error interno', {
      campo: 'matricula',
    });
    expect(mensajeDeError(error)).toBe('Ya existe un vehículo registrado con esa matrícula.');
  });

  it('traduce un ApiError sin detalles con el mensaje general del código', () => {
    expect(mensajeDeError(new ApiError('VEHICULO_CON_SINIESTROS', 409, 'x'))).toBe(
      'No puedes eliminar un vehículo que ya tiene siniestros reportados.',
    );
  });

  it('devuelve el mensaje genérico ante un código desconocido', () => {
    expect(mensajeDeError(new ApiError('OTRO_CODIGO', 500, 'x'))).toBe(MENSAJE_GENERICO);
  });

  it('devuelve mensaje de conexión ante un error de red', () => {
    expect(mensajeDeError(new TypeError('Failed to fetch'))).toBe(
      'No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.',
    );
  });

  it('devuelve un mensaje de tiempo agotado ante una solicitud lenta', () => {
    expect(mensajeDeError(new DOMException('Tiempo agotado', 'TimeoutError'))).toBe(
      'La operación tardó demasiado. Inténtalo de nuevo.',
    );
  });

  it('devuelve el mensaje genérico ante valores inesperados', () => {
    expect(mensajeDeError(undefined)).toBe(MENSAJE_GENERICO);
    expect(mensajeDeError(null)).toBe(MENSAJE_GENERICO);
    expect(mensajeDeError({})).toBe(MENSAJE_GENERICO);
  });
});