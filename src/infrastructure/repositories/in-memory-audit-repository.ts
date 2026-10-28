import type { AuditRepository } from '@/application/ports/audit-repository';
import type {
  RegistroAuditoria,
  RegistrarAuditoriaInput,
} from '@/application/ports/audit-repository';

/**
 * Auditoría en memoria para pruebas.
 */
export class InMemoryAuditRepository implements AuditRepository {
  private registros: RegistroAuditoria[] = [];
  private secuencia = 0;

  async registrar(input: RegistrarAuditoriaInput): Promise<void> {
    this.secuencia += 1;
    this.registros.push({
      id: `audit-${this.secuencia}`,
      entidad: input.entidad,
      entidadId: input.entidadId,
      accion: input.accion,
      actorTipo: input.actorTipo,
      actorId: input.actorId ?? null,
      datos: input.datos ?? null,
      creadoEn: new Date().toISOString(),
    });
  }

  async listarPorEntidad(entidad: string, entidadId: string): Promise<RegistroAuditoria[]> {
    return this.registros.filter((r) => r.entidad === entidad && r.entidadId === entidadId);
  }

  /** Todos los registros (para aserciones en pruebas). */
  todos(): RegistroAuditoria[] {
    return [...this.registros];
  }
}
