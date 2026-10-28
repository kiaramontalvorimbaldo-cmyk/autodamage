import type { ClaimRepository } from '@/application/ports/claim-repository';
import type {
  CambiosSiniestro,
  CambiosVehiculo,
  CrearEvaluacionInput,
  CrearImagenInput,
  CrearInspeccionInput,
  CrearSiniestroInput,
  CrearVehiculoInput,
} from '@/application/ports/claim-repository';
import type {
  EvaluacionDanos,
  ImagenSiniestro,
  InspeccionPericial,
  Siniestro,
  Vehiculo,
} from '@/domain/entities';
import type {
  CambiosEvaluacion,
  CambiosInspeccionDictamen,
  FiltrosSiniestros,
  ListaSiniestros,
} from '@/application/ports/claim-repository';
import type { Accion, Severidad } from '@/domain/types';
import { AppError } from '@/lib/errors';

function nuevoIdPrefijado(prefijo: string, secuencia: number): string {
  return `${prefijo}-${String(secuencia).padStart(12, '0')}`;
}

/**
 * Repositorio en memoria para pruebas.
 * Implementa el mismo contrato que SupabaseClaimRepository.
 */
export class InMemoryClaimRepository implements ClaimRepository {
  /** Reloj del repositorio (para pruebas con fecha fija). */
  ahora: Date = new Date();

  private vehiculos = new Map<string, Vehiculo>();
  private siniestros = new Map<string, Siniestro>();
  private imagenes = new Map<string, ImagenSiniestro>();
  private inspecciones = new Map<string, InspeccionPericial>();
  private evaluaciones = new Map<string, EvaluacionDanos>();
  private secuencia = 0;

  private id(): string {
    this.secuencia += 1;
    return nuevoIdPrefijado('00000000-0000-0000-0000', this.secuencia);
  }

  async crearVehiculo(input: CrearVehiculoInput): Promise<Vehiculo> {
    const vehiculo: Vehiculo = { id: this.id(), ...input };
    this.vehiculos.set(vehiculo.id, vehiculo);
    return vehiculo;
  }

  async obtenerVehiculoPorId(id: string): Promise<Vehiculo | null> {
    return this.vehiculos.get(id) ?? null;
  }

  async listarVehiculosPorAsegurado(aseguradoId: string): Promise<Vehiculo[]> {
    return [...this.vehiculos.values()].filter((v) => v.aseguradoId === aseguradoId);
  }

  async actualizarVehiculo(id: string, cambios: CambiosVehiculo): Promise<Vehiculo> {
    const vehiculo = this.vehiculos.get(id);
    if (!vehiculo) {
      throw new AppError('VEHICULO_NO_ENCONTRADO', 404, 'El vehículo no existe');
    }
    const actualizado: Vehiculo = { ...vehiculo, ...cambios, id: vehiculo.id };
    this.vehiculos.set(id, actualizado);
    return actualizado;
  }

  async eliminarVehiculo(id: string): Promise<void> {
    this.vehiculos.delete(id);
  }

  async obtenerVehiculoPorMatricula(matricula: string): Promise<Vehiculo | null> {
    return [...this.vehiculos.values()].find((v) => v.matricula === matricula) ?? null;
  }

  async obtenerVehiculoPorNumeroPoliza(numeroPoliza: string): Promise<Vehiculo | null> {
    return [...this.vehiculos.values()].find((v) => v.numeroPoliza === numeroPoliza) ?? null;
  }

  async contarSiniestrosPorVehiculo(vehiculoId: string): Promise<number> {
    return [...this.siniestros.values()].filter((s) => s.vehiculoId === vehiculoId).length;
  }

  async crearSiniestro(input: CrearSiniestroInput): Promise<Siniestro> {
    const siniestro: Siniestro = {
      ...input,
      id: input.id ?? this.id(),
      estado: 'PENDIENTE',
      ruta: null,
      analisisEstado: 'NO_INICIADO',
      requiereInspeccionPresencial: false,
      etiquetas: [],
    };
    this.siniestros.set(siniestro.id, siniestro);
    return siniestro;
  }

  async obtenerSiniestroPorId(id: string): Promise<Siniestro | null> {
    return this.siniestros.get(id) ?? null;
  }

  async listarSiniestrosPorAsegurado(aseguradoId: string): Promise<Siniestro[]> {
    return [...this.siniestros.values()].filter((s) => s.aseguradoId === aseguradoId);
  }

  async listarTodosLosSiniestros(): Promise<Siniestro[]> {
    return [...this.siniestros.values()];
  }

  async listarSiniestros(
    aseguradoId: string | null,
    filtros: FiltrosSiniestros,
  ): Promise<ListaSiniestros> {
    let items = [...this.siniestros.values()];
    if (aseguradoId !== null) {
      items = items.filter((s) => s.aseguradoId === aseguradoId);
    }
    if (filtros.ruta) {
      items = items.filter((s) => s.ruta === filtros.ruta);
    }
    if (filtros.estado) {
      items = items.filter((s) => s.estado === filtros.estado);
    }
    if (filtros.estados) items = items.filter((s) => filtros.estados!.includes(s.estado));
    items.sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro));
    const total = items.length;
    const inicio = (filtros.page - 1) * filtros.pageSize;
    return {
      items: items.slice(inicio, inicio + filtros.pageSize),
      total,
      page: filtros.page,
      pageSize: filtros.pageSize,
    };
  }

  async actualizarSiniestro(id: string, cambios: CambiosSiniestro): Promise<void> {
    const siniestro = this.siniestros.get(id);
    if (!siniestro) return;
    this.siniestros.set(id, { ...siniestro, ...cambios });
  }

  async contarImagenes(siniestroId: string): Promise<number> {
    return [...this.imagenes.values()].filter((i) => i.siniestroId === siniestroId).length;
  }

  async reservarAnalisis(
    id: string,
    analisisEsperado: Siniestro['analisisEstado'],
    estadoEsperado: Siniestro['estado'],
  ): Promise<boolean> {
    const actual = this.siniestros.get(id);
    if (
      !actual ||
      actual.analisisEstado !== analisisEsperado ||
      actual.estado !== estadoEsperado ||
      actual.analisisEstado === 'EN_PROCESO'
    )
      return false;
    this.siniestros.set(id, { ...actual, analisisEstado: 'EN_PROCESO' });
    return true;
  }

  async crearImagen(input: CrearImagenInput): Promise<ImagenSiniestro> {
    const imagen: ImagenSiniestro = { ...input };
    this.imagenes.set(imagen.id, imagen);
    return imagen;
  }

  async listarImagenes(siniestroId: string): Promise<ImagenSiniestro[]> {
    return [...this.imagenes.values()]
      .filter((i) => i.siniestroId === siniestroId)
      .sort((a, b) => a.orden - b.orden);
  }

  async listarHashesDeOtrosSiniestros(excluirSiniestroId: string): Promise<string[]> {
    return [...this.imagenes.values()]
      .filter((i) => i.siniestroId !== excluirSiniestroId)
      .map((i) => i.hashPerceptual);
  }

  async contarInspeccionesDigitalIaHoy(hoy: Date): Promise<number> {
    const inicioDelDia = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
    return [...this.inspecciones.values()].filter((ins) => {
      if (ins.tipoInspeccion !== 'DIGITAL_IA') return false;
      const fecha = new Date(ins.fechaInspeccion).getTime();
      return fecha >= inicioDelDia && fecha < inicioDelDia + 24 * 60 * 60 * 1000;
    }).length;
  }

  async crearInspeccion(input: CrearInspeccionInput): Promise<InspeccionPericial> {
    const inspeccion: InspeccionPericial = {
      id: this.id(),
      peritoId: null,
      fechaInspeccion: this.ahora.toISOString(),
      kilometraje: null,
      observacionesPerito: null,
      dictamenFinal: null,
      ...input,
      nivelSeveridad: (input.nivelSeveridad as Severidad | null) ?? null,
    };
    this.inspecciones.set(inspeccion.id, inspeccion);
    return inspeccion;
  }

  async obtenerInspeccionPorSiniestro(siniestroId: string): Promise<InspeccionPericial | null> {
    const delSiniestro = [...this.inspecciones.values()]
      .reverse()
      .filter((i) => i.siniestroId === siniestroId)
      .sort((a, b) => b.fechaInspeccion.localeCompare(a.fechaInspeccion));
    return delSiniestro[0] ?? null;
  }

  async actualizarInspeccionDictamen(
    inspeccionId: string,
    cambios: CambiosInspeccionDictamen,
  ): Promise<void> {
    const inspeccion = this.inspecciones.get(inspeccionId);
    if (!inspeccion) return;
    this.inspecciones.set(inspeccionId, { ...inspeccion, ...cambios });
  }

  async crearEvaluaciones(evaluaciones: CrearEvaluacionInput[]): Promise<void> {
    for (const ev of evaluaciones) {
      const evaluacion: EvaluacionDanos = {
        id: this.id(),
        aprobadoPorPerito: true,
        observacionPieza: null,
        ...ev,
        accionRequerida: ev.accionRequerida as Accion,
      };
      this.evaluaciones.set(evaluacion.id, evaluacion);
    }
  }

  async listarEvaluacionesPorInspeccion(inspeccionId: string): Promise<EvaluacionDanos[]> {
    return [...this.evaluaciones.values()].filter((e) => e.inspeccionId === inspeccionId);
  }

  async obtenerEvaluacionPorId(id: string): Promise<EvaluacionDanos | null> {
    return this.evaluaciones.get(id) ?? null;
  }

  async actualizarEvaluacion(evaluacionId: string, cambios: CambiosEvaluacion): Promise<void> {
    const evaluacion = this.evaluaciones.get(evaluacionId);
    if (!evaluacion) return;
    this.evaluaciones.set(evaluacionId, {
      ...evaluacion,
      ...cambios,
      accionRequerida: cambios.accionRequerida ?? evaluacion.accionRequerida,
    });
  }
}
