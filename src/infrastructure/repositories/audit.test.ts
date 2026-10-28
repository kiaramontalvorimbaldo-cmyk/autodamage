import { describe, expect, it } from 'vitest';
import { InMemoryAuditRepository } from '@/infrastructure/repositories/in-memory-audit-repository';

describe('audit log', () => {
  it('cada registro conserva actor, acción y datos', async () => {
    const auditoria = new InMemoryAuditRepository();
    await auditoria.registrar({
      entidad: 'siniestro',
      entidadId: 's1',
      accion: 'TRIAJE_DECIDIDO',
      actorTipo: 'SISTEMA',
      datos: { ruta: 'VERDE' },
    });
    await auditoria.registrar({
      entidad: 'siniestro',
      entidadId: 's1',
      accion: 'ANALISIS_IA_COMPLETADO',
      actorTipo: 'IA',
    });
    const registros = await auditoria.listarPorEntidad('siniestro', 's1');
    expect(registros).toHaveLength(2);
    expect(registros[0].actorTipo).toBe('SISTEMA');
    expect(registros[1].actorTipo).toBe('IA');
    expect((registros[0].datos as { ruta: string }).ruta).toBe('VERDE');
  });

  it('listarPorEntidad distingue entidades e ids', async () => {
    const auditoria = new InMemoryAuditRepository();
    await auditoria.registrar({
      entidad: 'siniestro',
      entidadId: 's1',
      accion: 'A',
      actorTipo: 'SISTEMA',
    });
    await auditoria.registrar({
      entidad: 'ordenes_trabajo',
      entidadId: 's1',
      accion: 'B',
      actorTipo: 'USUARIO',
    });
    expect(await auditoria.listarPorEntidad('siniestro', 's1')).toHaveLength(1);
    expect(await auditoria.listarPorEntidad('ordenes_trabajo', 's1')).toHaveLength(1);
    expect(await auditoria.listarPorEntidad('siniestro', 'otro')).toHaveLength(0);
  });
});
