/**
 * Puerto del servicio de almacenamiento de evidencias
(bucket privado "evidencias" de Supabase Storage).
 */
export interface StorageService {
  subir(input: { camino: string; contenido: Buffer; tipoMime: string }): Promise<void>;
  descargar(camino: string): Promise<Buffer>;
  /** Compensa una subida que no pudo registrarse. Solo la ruta recién creada. */
  eliminar(camino: string): Promise<void>;
  /** URL firmada con expiración (segundos). */
  urlFirmado(camino: string, expiracionSegundos: number): Promise<string>;
}
