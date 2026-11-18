import { describe, it, expect } from 'vitest';
import { crearSiniestroSchema } from './siniestro';
import { detallesIncidenteSchema, describirIncidente } from './incident';
const details = {
  tipo: 'ESTACIONADO',
  lugar: 'Avenida América, Cochabamba',
  relato: 'El vehículo estaba estacionado y encontré un golpe en el faro izquierdo.',
  danos: 'Faro delantero izquierdo roto.',
  otros_vehiculos: 'NO_SE',
  personas_heridas: 'NO',
};
describe('Detalle guiado del incidente', () => {
  it('no acepta crear un reporte solo con un texto libre', () => {
    expect(
      crearSiniestroSchema.safeParse({
        vehiculo_id: '123e4567-e89b-42d3-a456-426614174000',
        descripcion: 'muy feo',
        latitud: -17,
        longitud: -66,
        fecha_incidente: new Date().toISOString(),
      }).success,
    ).toBe(false);
  });
  it.each(['tipo', 'lugar', 'relato', 'danos', 'otros_vehiculos', 'personas_heridas'])(
    'exige %s sin respuestas predeterminadas',
    (key) => {
      expect(detallesIncidenteSchema.safeParse({ ...details, [key]: '' }).success).toBe(false);
    },
  );
  it('rechaza relatos cortos o espacios en blanco', () => {
    expect(detallesIncidenteSchema.safeParse({ ...details, relato: 'muy feo' }).success).toBe(
      false,
    );
    expect(detallesIncidenteSchema.safeParse({ ...details, lugar: ' '.repeat(20) }).success).toBe(
      false,
    );
  });
  it('no convierte respuestas desconocidas en negativas', () => {
    const parsed = detallesIncidenteSchema.parse(details);
    expect(describirIncidente(parsed)).toContain('Otros vehículos: No lo sé');
    expect(describirIncidente(parsed)).toContain('Personas heridas: No');
  });
  it('señala una contradicción entre colisión y otros vehículos', () => {
    const parsed = detallesIncidenteSchema.safeParse({
      ...details,
      tipo: 'COLISION_VEHICULO',
      otros_vehiculos: 'NO',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].path).toEqual(['otros_vehiculos']);
  });
  it('mantiene el resumen dentro del límite del expediente', () => {
    const parsed = detallesIncidenteSchema.parse({
      ...details,
      lugar: 'x'.repeat(180),
      relato: 'x'.repeat(900),
      danos: 'x'.repeat(350),
    });
    expect(describirIncidente(parsed).length).toBeLessThanOrEqual(2000);
  });
});
