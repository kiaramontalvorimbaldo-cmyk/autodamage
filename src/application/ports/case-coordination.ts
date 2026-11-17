export type MensajeCaso = {
  id: string;
  secuencia: string;
  nombre: string;
  rol: 'TALLER' | 'PERITO';
  contenido: string;
  fecha: string;
};

export type CoordinacionCaso = {
  fechaEntrega: string | null;
  mensajes: MensajeCaso[];
  antes: string | null;
};

export interface CaseCoordinationRepository {
  consultar(siniestro: string, antes?: string): Promise<CoordinacionCaso>;
  enviar(siniestro: string, id: string, contenido: string): Promise<void>;
  programar(siniestro: string, fecha: string, anterior: string | null): Promise<void>;
}
