import { describe, expect, it } from 'vitest';
import { calcularPasos } from '@/components/claim/ClaimTimeline';
import type { Siniestro } from '@/domain/entities';

function siniestroParcial(
  estado: Siniestro['estado'],
  analisisEstado: Siniestro['analisisEstado'] = 'COMPLETADO',
): Siniestro {
  return {
    id: '1',
    aseguradoId: 'a',
    vehiculoId: 'v',
    fechaRegistro: '2026-01-01T00:00:00Z',
    fechaIncidente: '2026-01-01T00:00:00Z',
    latitud: 0,
    longitud: 0,
    descripcion: null,
    estado,
    ruta: null,
    analisisEstado,
    requiereInspeccionPresencial: false,
    etiquetas: [],
  };
}

describe('ClaimTimeline', () => {
  it('marca Reportado como completado y Analizado como actual cuando está EN_PROCESO', () => {
    const pasos = calcularPasos(siniestroParcial('PENDIENTE', 'EN_PROCESO'));
    expect(pasos[0]).toMatchObject({ clave: 'reportado', completado: true, actual: false });
    expect(pasos[1]).toMatchObject({ clave: 'analizado', completado: false, actual: true });
  });

  it('muestra Revisión del perito como actual cuando está EN_REVISION', () => {
    const pasos = calcularPasos(siniestroParcial('EN_REVISION'));
    const revision = pasos.find((p) => p.clave === 'revision');
    expect(revision).toMatchObject({ actual: true, completado: false });
  });

  it('muestra la orden emitida sin adelantar la reparación en FAST_TRACK', () => {
    const pasos = calcularPasos(siniestroParcial('FAST_TRACK'), 'EMITIDA');
    expect(pasos.some((p) => p.clave === 'aprobado' && p.completado)).toBe(true);
    expect(pasos.some((p) => p.clave === 'reparacion' && p.actual)).toBe(false);
    expect(pasos.some((p) => p.clave === 'orden' && p.actual)).toBe(true);
    expect(pasos.some((p) => p.clave === 'finalizado' && !p.completado)).toBe(true);
  });

  it('marca reparación solo cuando el taller avanza la orden', () => {
    expect(
      calcularPasos(siniestroParcial('APROBADO'), 'EN_REPARACION').find(
        (p) => p.clave === 'reparacion',
      )?.actual,
    ).toBe(true);
  });

  it('marca todos los pasos como completados cuando está FINALIZADO', () => {
    const pasos = calcularPasos(siniestroParcial('FINALIZADO'));
    expect(pasos.every((p) => p.completado)).toBe(true);
    expect(pasos.some((p) => p.actual)).toBe(false);
  });

  it('no muestra pasos de reparación cuando está RECHAZADO', () => {
    const pasos = calcularPasos(siniestroParcial('RECHAZADO'));
    expect(pasos.some((p) => p.clave === 'reparacion')).toBe(false);
    expect(pasos.some((p) => p.clave === 'finalizado')).toBe(false);
  });
});
