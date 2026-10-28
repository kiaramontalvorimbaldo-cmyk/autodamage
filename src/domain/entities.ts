/**
 * Entidades del dominio (camelCase en español).
 * Los repositorios mapean entre estas entidades y las filas snake_case de la BD.
 */
import type {
  Accion,
  DictamenFinal,
  EstadoAnalisis,
  EstadoOrden,
  EstadoSiniestro,
  Ruta,
  Severidad,
  TipoInspeccion,
  VerdictFraude,
} from '@/domain/types';

export type Vehiculo = {
  id: string;
  aseguradoId: string;
  matricula: string;
  marca: string;
  modelo: string;
  numeroPoliza: string;
};

export type Siniestro = {
  id: string;
  aseguradoId: string;
  vehiculoId: string;
  fechaRegistro: string;
  fechaIncidente: string;
  latitud: number;
  longitud: number;
  descripcion: string | null;
  estado: EstadoSiniestro;
  ruta: Ruta | null;
  analisisEstado: EstadoAnalisis;
  analisisToken?: string | null;
  analisisIniciadoEn?: string | null;
  requiereInspeccionPresencial: boolean;
  etiquetas: Etiqueta[];
};

import type { Etiqueta } from '@/domain/types';

export type ImagenSiniestro = {
  recibidaEn?: string;
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

export type InspeccionPericial = {
  id: string;
  siniestroId: string;
  peritoId: string | null;
  fechaInspeccion: string;
  tipoInspeccion: TipoInspeccion;
  kilometraje: number | null;
  observacionesPerito: string | null;
  dictamenFinal: DictamenFinal | null;
  verdictFraude: VerdictFraude;
  indicadoresFraude: VerdictFraude[];
  nivelSeveridad: Severidad | null;
  costoTotalEstimado: number | null;
  confianzaGlobal: number | null;
  modeloIa: string | null;
  versionPrompt: string | null;
  respuestaIa: unknown;
};

export type EvaluacionDanos = {
  id: string;
  inspeccionId: string;
  codigoPieza: string;
  accionRequerida: Accion;
  horasManoObra: number;
  costoPiezaEstimado: number;
  confianza: number | null;
  imagenId: string | null;
  bbox: [number, number, number, number] | null;
  aprobadoPorPerito: boolean;
  observacionPieza: string | null;
};

export type Taller = {
  id: string;
  usuarioId: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  activo: boolean;
};

export type Orden = {
  id: string;
  siniestroId: string;
  tallerId: string;
  estado: EstadoOrden;
  montoAutorizado: number;
  creadoEn: string;
  actualizadoEn: string;
};
