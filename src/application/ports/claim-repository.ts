import type {
  EvaluacionDanos,
  ImagenSiniestro,
  InspeccionPericial,
  Siniestro,
  Vehiculo,
} from '@/domain/entities';
import type { RegistrarAuditoriaInput } from './audit-repository';
import type {
  Accion,
  DictamenFinal,
  EstadoAnalisis,
  EstadoSiniestro,
  Etiqueta,
  Ruta,
  TipoInspeccion,
  VerdictFraude,
} from '@/domain/types';

export type CrearVehiculoInput = {
  aseguradoId: string;
  matricula: string;
  marca: string;
  modelo: string;
  numeroPoliza: string;
};

/** Campos editables de un vehículo. */
export type CambiosVehiculo = Partial<{
  matricula: string;
  marca: string;
  modelo: string;
  numeroPoliza: string;
}>;

export type CrearSiniestroInput = {
  id?: string;
  aseguradoId: string;
  vehiculoId: string;
  descripcion: string | null;
  latitud: number;
  longitud: number;
  fechaIncidente: string;
  fechaRegistro: string;
};

export type CrearImagenInput = {
  id: string;
  siniestroId: string;
  storagePath: string;
  hashPerceptual: string;
  capturadaEn: string;
  latitud: number | null;
  longitud: number | null;
  precisionGpsM: number | null;
  userAgent: string | null;
  orden: number;
  rostrosDifuminados: boolean;
};

export type CambiosSiniestro = Partial<{
  estado: EstadoSiniestro;
  ruta: Ruta;
  analisisEstado: EstadoAnalisis;
  requiereInspeccionPresencial: boolean;
  etiquetas: Etiqueta[];
}>;

export type CrearInspeccionInput = {
  siniestroId: string;
  tipoInspeccion: TipoInspeccion;
  verdictFraude: VerdictFraude;
  indicadoresFraude: VerdictFraude[];
  nivelSeveridad: string | null;
  costoTotalEstimado: number | null;
  confianzaGlobal: number | null;
  modeloIa: string | null;
  versionPrompt: string | null;
  respuestaIa: unknown;
};

export type CrearEvaluacionInput = {
  inspeccionId: string;
  codigoPieza: string;
  accionRequerida: string;
  horasManoObra: number;
  costoPiezaEstimado: number;
  confianza: number | null;
  imagenId: string | null;
  bbox: [number, number, number, number] | null;
};

/** Filtros y paginación para listar siniestros. */
export type FiltrosSiniestros = {
  estados?: EstadoSiniestro[];
  ruta?: Ruta;
  estado?: EstadoSiniestro;
  orden?: 'asc' | 'desc';
  page: number;
  pageSize: number;
};

export type ListaSiniestros = {
  items: Siniestro[];
  total: number;
  page: number;
  pageSize: number;
};

/** Dictamen del perito sobre una inspección. */
export type CambiosInspeccionDictamen = {
  peritoId: string;
  dictamenFinal: DictamenFinal;
  observacionesPerito: string | null;
  kilometraje: number | null;
  costoTotalEstimado: number | null;
};

/** Ajustes del perito sobre una evaluación de pieza. */
export type CambiosEvaluacion = {
  accionRequerida?: Accion;
  costoPiezaEstimado?: number;
  aprobadoPorPerito?: boolean;
  observacionPieza?: string | null;
};

/**
 * Puerto del repositorio de siniestros (y su agregado:
 * imágenes, inspecciones y evaluaciones de daños).
 */
export interface ClaimRepository {
  fallarAnalisis?(id: string, token: string | null): Promise<boolean>;
  recuperarAnalisis?(id: string, usuarioId: string): Promise<void>;
  guardarAnalisisAtomico?(input: {
    token?: string | null;
    inspeccion: CrearInspeccionInput;
    evaluaciones: Omit<CrearEvaluacionInput, 'inspeccionId'>[];
    cambios: CambiosSiniestro;
    auditoria: RegistrarAuditoriaInput[];
  }): Promise<void>;
  registrarImagenAtomica?(input: CrearImagenInput, ampliacionId?: string): Promise<ImagenSiniestro>;
  entregarAmpliacionAtomica?(
    siniestroId: string,
    usuarioId: string,
    ampliacionId: string,
  ): Promise<void>;
  registrarDictamenAtomico?(input: {
    siniestroId: string;
    inspeccionId: string;
    cambios: CambiosInspeccionDictamen;
    ajustes: { id: string; cambios: CambiosEvaluacion }[];
  }): Promise<void>;
  crearVehiculo(input: CrearVehiculoInput): Promise<Vehiculo>;
  obtenerVehiculoPorId(id: string): Promise<Vehiculo | null>;
  listarVehiculosPorAsegurado(aseguradoId: string): Promise<Vehiculo[]>;
  actualizarVehiculo(id: string, cambios: CambiosVehiculo): Promise<Vehiculo>;
  eliminarVehiculo(id: string): Promise<void>;
  obtenerVehiculoPorMatricula(matricula: string): Promise<Vehiculo | null>;
  obtenerVehiculoPorNumeroPoliza(numeroPoliza: string): Promise<Vehiculo | null>;
  /** Siniestros asociados al vehículo (bloquea el borrado). */
  contarSiniestrosPorVehiculo(vehiculoId: string): Promise<number>;

  crearSiniestro(input: CrearSiniestroInput): Promise<Siniestro>;
  obtenerSiniestroPorId(id: string): Promise<Siniestro | null>;
  listarSiniestrosPorAsegurado(aseguradoId: string): Promise<Siniestro[]>;
  listarTodosLosSiniestros(): Promise<Siniestro[]>;
  actualizarSiniestro(id: string, cambios: CambiosSiniestro): Promise<void>;
  /** Comparación y actualización atómica: solo un solicitante puede reservar el análisis. */
  reservarAnalisis(
    id: string,
    analisisEsperado: EstadoAnalisis,
    estadoEsperado: EstadoSiniestro,
  ): Promise<boolean>;
  /** Lista paginada con filtros. `aseguradoId = null` → todos (PERITO/ADMIN). */
  listarSiniestros(
    aseguradoId: string | null,
    filtros: FiltrosSiniestros,
  ): Promise<ListaSiniestros>;

  contarImagenes(siniestroId: string): Promise<number>;
  crearImagen(input: CrearImagenInput): Promise<ImagenSiniestro>;
  listarImagenes(siniestroId: string): Promise<ImagenSiniestro[]>;
  /** Hashes perceptuales de imágenes de OTROS siniestros (anti-fraude). */
  listarHashesDeOtrosSiniestros(excluirSiniestroId: string): Promise<string[]>;

  /** Inspecciones DIGITAL_IA creadas hoy (para el límite diario de cuota). */
  contarInspeccionesDigitalIaHoy(hoy: Date): Promise<number>;
  crearInspeccion(input: CrearInspeccionInput): Promise<InspeccionPericial>;
  obtenerInspeccionPorSiniestro(siniestroId: string): Promise<InspeccionPericial | null>;
  /** Registra el dictamen del perito en la inspección. */
  actualizarInspeccionDictamen(
    inspeccionId: string,
    cambios: CambiosInspeccionDictamen,
  ): Promise<void>;
  crearEvaluaciones(evaluaciones: CrearEvaluacionInput[]): Promise<void>;
  listarEvaluacionesPorInspeccion(inspeccionId: string): Promise<EvaluacionDanos[]>;
  obtenerEvaluacionPorId(id: string): Promise<EvaluacionDanos | null>;
  /** Aplica los ajustes del perito a una evaluación de pieza. */
  actualizarEvaluacion(evaluacionId: string, cambios: CambiosEvaluacion): Promise<void>;
}
