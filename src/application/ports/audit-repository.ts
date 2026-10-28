/**
 * Puerto del repositorio de auditoría (audit_log inmutable).
 */
export type RegistrarAuditoriaInput = {
  entidad: string;
  entidadId: string;
  accion: string;
  actorTipo: 'USUARIO' | 'SISTEMA' | 'IA';
  actorId?: string | null;
  datos?: unknown;
};

export type RegistroAuditoria = {
  id: string;
  entidad: string;
  entidadId: string;
  accion: string;
  actorTipo: string;
  actorId: string | null;
  datos: unknown;
  creadoEn: string;
};

export interface AuditRepository {
  registrar(input: RegistrarAuditoriaInput): Promise<void>;
  listarPorEntidad(entidad: string, entidadId: string): Promise<RegistroAuditoria[]>;
}
