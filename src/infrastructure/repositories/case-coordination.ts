import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import type { CaseCoordinationRepository } from '@/application/ports/case-coordination';

const respuesta = z.object({
  fechaEntrega: z.string().date().nullable(),
  mensajes: z.array(
    z.object({
      id: z.string().uuid(),
      secuencia: z.string().regex(/^\d+$/),
      nombre: z.string(),
      rol: z.enum(['TALLER', 'PERITO']),
      contenido: z.string(),
      fecha: z.string(),
    }),
  ),
});

function comprobar(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.message.includes('SIN_PERMISO'))
    throw new AppError(
      'SIN_PERMISO',
      403,
      'La conversación está disponible para el taller y el perito asignados a este caso.',
    );
  if (error.code === 'PGRST202' || error.code === '42883')
    throw new AppError(
      'COORDINACION_PENDIENTE',
      503,
      'Falta habilitar la conversación y la entrega en la base de datos.',
    );
  if (error.message.includes('FECHA_CAMBIADA'))
    throw new AppError(
      'FECHA_CAMBIADA',
      409,
      'La entrega cambió desde que abriste el caso. Actualiza antes de guardar.',
    );
  if (error.message.includes('ESTADO_INVALIDO'))
    throw new AppError(
      'ESTADO_INVALIDO',
      409,
      'La reparación está completada. La fecha de entrega ya no puede cambiarse.',
    );
  if (error.message.includes('VALIDACION_ERROR'))
    throw new AppError('VALIDACION_ERROR', 400, 'Revisa la fecha o el texto ingresado.');
  if (error.message.includes('SOLICITUD_CONFLICTIVA'))
    throw new AppError(
      'SOLICITUD_CONFLICTIVA',
      409,
      'El envío ya fue utilizado con otro contenido.',
    );
  throw new AppError(
    'COORDINACION_ERROR',
    502,
    'No se confirmó la operación. Actualiza la conversación antes de reintentar.',
  );
}

/** Usa la sesión del solicitante. Los permisos se comprueban también en PostgreSQL. */
export class SupabaseCaseCoordination implements CaseCoordinationRepository {
  constructor(private readonly db: SupabaseClient) {}

  async consultar(siniestro: string, antes?: string) {
    const { data, error } = await this.db.rpc('consultar_coordinacion', {
      p_siniestro: siniestro,
      p_antes: antes ?? null,
    });
    comprobar(error);
    const valor = respuesta.parse(data);
    const mas = valor.mensajes.length > 100;
    const mensajes = mas ? valor.mensajes.slice(1) : valor.mensajes;
    return { ...valor, mensajes, antes: mas ? mensajes[0].secuencia : null };
  }

  async enviar(siniestro: string, id: string, contenido: string) {
    const { error } = await this.db.rpc('enviar_mensaje_siniestro', {
      p_siniestro: siniestro,
      p_id: id,
      p_contenido: contenido,
    });
    comprobar(error);
  }

  async programar(siniestro: string, fecha: string, anterior: string | null) {
    const { error } = await this.db.rpc('programar_entrega', {
      p_siniestro: siniestro,
      p_fecha: fecha,
      p_anterior: anterior,
    });
    comprobar(error);
  }
}
