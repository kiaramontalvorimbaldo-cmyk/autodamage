import { describe, expect, it } from 'vitest';
import { alinearResultados, leerEtiquetasCsv } from '../../scripts/lib/evaluation-data';

const cabecera = 'archivo,severidad,piezas,es_recaptura\n';
describe('conjunto de evaluación', () => {
  it('debería aceptar etiquetas válidas y lista de piezas vacía', () => {
    expect(leerEtiquetasCsv(cabecera + 'foto.jpg,LEVE,,false', ['FARO'])).toEqual([
      { archivo: 'foto.jpg', severidad: 'LEVE', piezas: [], esRecaptura: false },
    ]);
  });
  it.each([
    'foto.jpg,CRITICO,,false',
    '../foto.jpg,LEVE,,false',
    'C:\\foto.jpg,LEVE,,false',
    'foto.jpg,LEVE,,si',
    'foto.jpg,LEVE,INVENTADA,false',
    'foto.jpg,LEVE,,false\nFOTO.JPG,LEVE,,false',
    '',
  ])('debería rechazar un conjunto inválido: %s', (fila) => {
    expect(() => leerEtiquetasCsv(cabecera + fila, ['FARO'])).toThrow();
  });
  it('debería alinear predicciones reanudadas por archivo', () => {
    const reales = leerEtiquetasCsv(cabecera + 'a.jpg,LEVE,FARO,false\nb.jpg,SEVERO,,true', [
      'FARO',
    ]);
    const datos = alinearResultados(reales, [
      {
        archivo: 'b.jpg',
        latenciaMs: 200,
        pred: { severidad: 'SEVERO', piezas: [], esRecaptura: true },
      },
      {
        archivo: 'a.jpg',
        latenciaMs: 100,
        pred: { severidad: 'LEVE', piezas: ['FARO'], esRecaptura: false },
      },
    ]);
    expect(datos.predichas.map((p) => p.severidad)).toEqual(['LEVE', 'SEVERO']);
    expect(datos.latencias).toEqual([100, 200]);
  });
});
