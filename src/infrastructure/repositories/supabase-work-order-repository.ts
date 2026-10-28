import { workflowRpc } from '@/infrastructure/supabase/workflow-rpc';
import { getAdminClient } from '@/infrastructure/supabase/admin-client';
import { workflowError } from '@/infrastructure/supabase/workflow-error';
import { tabla } from '@/infrastructure/supabase/tabla';
import type {
  CrearOrdenInput,
  WorkOrderRepository,
} from '@/application/ports/work-order-repository';
import type { Orden, Taller } from '@/domain/entities';
import type { EstadoOrden } from '@/domain/types';

const ESTADOS_ABIERTOS: EstadoOrden[] = ['EMITIDA', 'RECIBIDO', 'EN_REPARACION'];

function aTaller(fila: Record<string, unknown>): Taller {
  return {
    id: fila.id as string,
    usuarioId: fila.usuario_id as string,
    nombre: fila.nombre as string,
    direccion: (fila.direccion as string | null) ?? null,
    telefono: (fila.telefono as string | null) ?? null,
    activo: fila.activo as boolean,
  };
}

function aOrden(fila: Record<string, unknown>): Orden {
  return {
    id: fila.id as string,
    siniestroId: fila.siniestro_id as string,
    tallerId: fila.taller_id as string,
    estado: fila.estado as EstadoOrden,
    montoAutorizado: Number(fila.monto_autorizado),
    creadoEn: fila.creado_en as string,
    actualizadoEn: fila.actualizado_en as string,
  };
}

export class SupabaseWorkOrderRepository implements WorkOrderRepository {
  async emitirAtomico(
    siniestroId: string,
    actorTipo: 'USUARIO' | 'SISTEMA',
    actorId: string | null,
  ): Promise<Orden | null> {
    const { data, error } = await workflowRpc('emitir_orden_atomico', {
      p_siniestro: siniestroId,
      p_actor_tipo: actorTipo,
      p_actor: actorId,
    });
    if (error) workflowError(error);
    return data ? aOrden(data as Record<string, unknown>) : null;
  }
  async avanzarAtomico(ordenId: string, usuarioId: string, estado: EstadoOrden): Promise<void> {
    const { error } = await workflowRpc('avanzar_orden_atomico', {
      p_orden: ordenId,
      p_usuario: usuarioId,
      p_estado: estado,
    });
    if (error) workflowError(error);
  }
  async listarTalleres(): Promise<Taller[]> {
    const { data, error } = await tabla(getAdminClient(), 'talleres').select();
    if (error) throw new Error('No se pudo consultar las órdenes o talleres');
    if (!data) return [];
    return (data as unknown as Record<string, unknown>[]).map(aTaller);
  }

  async obtenerTallerPorId(id: string): Promise<Taller | null> {
    const { data, error } = await tabla(getAdminClient(), 'talleres')
      .select()
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error('No se pudo consultar la orden o el taller');
    if (!data) return null;
    return aTaller(data as Record<string, unknown>);
  }

  async obtenerTallerPorUsuario(usuarioId: string): Promise<Taller | null> {
    const { data, error } = await tabla(getAdminClient(), 'talleres')
      .select()
      .eq('usuario_id', usuarioId)
      .maybeSingle();
    if (error) throw new Error('No se pudo consultar la orden o el taller');
    if (!data) return null;
    return aTaller(data as Record<string, unknown>);
  }

  async contarOrdenesAbiertas(tallerId: string): Promise<number> {
    const { count, error } = await tabla(getAdminClient(), 'ordenes_trabajo')
      .select('id', { count: 'exact', head: true })
      .eq('taller_id', tallerId)
      .in('estado', ESTADOS_ABIERTOS);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  async ordenAbiertaMasAntigua(tallerId: string): Promise<Date | null> {
    const { data, error } = await tabla(getAdminClient(), 'ordenes_trabajo')
      .select('creado_en')
      .eq('taller_id', tallerId)
      .in('estado', ESTADOS_ABIERTOS)
      .order('creado_en', { ascending: true })
      .limit(1);
    if (error) throw new Error(error.message);
    const filas = data as unknown as { creado_en: string }[] | null;
    if (!filas || filas.length === 0) return null;
    return new Date(filas[0].creado_en);
  }

  async crearOrden(input: CrearOrdenInput): Promise<Orden> {
    const { data, error } = await tabla(getAdminClient(), 'ordenes_trabajo')
      .insert({
        siniestro_id: input.siniestroId,
        taller_id: input.tallerId,
        monto_autorizado: input.montoAutorizado,
      })
      .select()
      .single();
    if (error || !data) {
      throw new Error(`No se pudo crear la orden: ${error?.message}`);
    }
    return aOrden(data as Record<string, unknown>);
  }

  async obtenerOrdenPorSiniestro(siniestroId: string): Promise<Orden | null> {
    const { data, error } = await tabla(getAdminClient(), 'ordenes_trabajo')
      .select()
      .eq('siniestro_id', siniestroId)
      .maybeSingle();
    if (error) throw new Error('No se pudo consultar la orden o el taller');
    if (!data) return null;
    return aOrden(data as Record<string, unknown>);
  }

  async obtenerOrdenPorId(id: string): Promise<Orden | null> {
    const { data, error } = await tabla(getAdminClient(), 'ordenes_trabajo')
      .select()
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error('No se pudo consultar la orden o el taller');
    if (!data) return null;
    return aOrden(data as Record<string, unknown>);
  }

  async listarOrdenesPorTaller(tallerId: string, estado?: EstadoOrden): Promise<Orden[]> {
    let consulta = tabla(getAdminClient(), 'ordenes_trabajo')
      .select()
      .eq('taller_id', tallerId)
      .order('creado_en', { ascending: false });
    if (estado) consulta = consulta.eq('estado', estado);
    const { data, error } = await consulta;
    if (error) throw new Error('No se pudo consultar las órdenes o talleres');
    if (!data) return [];
    return (data as unknown as Record<string, unknown>[]).map(aOrden);
  }

  async listarTodasLasOrdenes(estado?: EstadoOrden): Promise<Orden[]> {
    let consulta = tabla(getAdminClient(), 'ordenes_trabajo')
      .select()
      .order('creado_en', { ascending: false });
    if (estado) consulta = consulta.eq('estado', estado);
    const { data, error } = await consulta;
    if (error) throw new Error('No se pudo consultar las órdenes o talleres');
    if (!data) return [];
    return (data as unknown as Record<string, unknown>[]).map(aOrden);
  }

  async actualizarEstadoOrden(id: string, estado: EstadoOrden): Promise<void> {
    const { error } = await tabla(getAdminClient(), 'ordenes_trabajo')
      .update({ estado, actualizado_en: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      throw new Error(`No se pudo actualizar la orden: ${error.message}`);
    }
  }
}
