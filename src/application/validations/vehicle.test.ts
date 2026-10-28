import { describe, expect, it } from 'vitest';
import { vehiculoSchema } from './vehicle';

const vehiculoValido = {
  matricula: 'ABC-123',
  marca: 'Toyota',
  modelo: 'Corolla',
  numero_poliza: 'POL-2026-001',
};

describe('vehiculoSchema', () => {
  it('acepta un vehículo válido', () => {
    expect(vehiculoSchema.safeParse(vehiculoValido).success).toBe(true);
  });

  it.each(['matricula', 'marca', 'modelo', 'numero_poliza'] as const)(
    'rechaza %s vacío',
    (campo) => {
      const resultado = vehiculoSchema.safeParse({ ...vehiculoValido, [campo]: '' });
      expect(resultado.success).toBe(false);
    },
  );

  it('rechaza campos ausentes', () => {
    expect(vehiculoSchema.safeParse({}).success).toBe(false);
  });

  it('rechaza valores más largos que el límite de la BD', () => {
    const resultado = vehiculoSchema.safeParse({ ...vehiculoValido, matricula: 'X'.repeat(21) });
    expect(resultado.success).toBe(false);
  });
});
