import { describe, expect, it } from 'vitest';
import { assignWorkshop, type TallerCandidato } from './assign-workshop';

const t = (
  id: string,
  ordenesAbiertas: number,
  masAntigua: string | null = null,
  activo = true,
): TallerCandidato => ({
  id,
  activo,
  ordenesAbiertas,
  ordenAbiertaMasAntigua: masAntigua ? new Date(masAntigua) : null,
});

describe('assignWorkshop', () => {
  it('elige el de menor carga', () => {
    expect(assignWorkshop([t('a', 5), t('b', 1), t('c', 3)])).toBe('b');
  });

  it('desempata por la orden abierta más antigua', () => {
    expect(assignWorkshop([t('a', 2, '2026-01-10'), t('b', 2, '2026-01-05')])).toBe('b');
  });

  it('sin órdenes, gana el menor id', () => {
    expect(assignWorkshop([t('zz', 0), t('aa', 0)])).toBe('aa');
  });

  it('ignora talleres inactivos', () => {
    expect(assignWorkshop([t('a', 0, null, false), t('b', 4)])).toBe('b');
  });

  it('falla si no hay talleres activos', () => {
    expect(() => assignWorkshop([t('a', 0, null, false)])).toThrowError(/talleres activos/);
  });
});
