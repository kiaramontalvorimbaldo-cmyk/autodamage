import { describe, expect, it } from 'vitest';
import { formatCurrencyUsd, formatIsoDate, formatName, rolLabel } from './format';

describe('formatCurrencyUsd', () => {
  it('formatea como USD con dos decimales', () => {
    const texto = formatCurrencyUsd(150);
    expect(texto).toContain('150');
    expect(texto).toMatch(/US\$|USD/);
  });

  it('redondea a dos decimales antes de formatear', () => {
    const texto = formatCurrencyUsd(12.346);
    expect(texto).toContain('12,35');
  });
});

describe('formatIsoDate', () => {
  it('formatea una fecha ISO válida', () => {
    const texto = formatIsoDate('2026-01-15T10:30:00.000Z');
    expect(texto).toContain('2026');
  });

  it('devuelve — para fechas inválidas', () => {
    expect(formatIsoDate('no-es-fecha')).toBe('—');
  });
});

describe('formatName', () => {
  it('capitaliza cada palabra en minúsculas', () => {
    expect(formatName('kiara montalvo')).toBe('Kiara Montalvo');
  });

  it('recorta y reduce espacios dobles', () => {
    expect(formatName('  kiara   montalvo  ')).toBe('Kiara Montalvo');
  });

  it('respeta mayúsculas ya escritas', () => {
    expect(formatName('KIARA MONTALVO')).toBe('KIARA MONTALVO');
  });

  it('devuelve cadena vacía para entradas vacías', () => {
    expect(formatName('')).toBe('');
    expect(formatName('   ')).toBe('');
    expect(formatName(null)).toBe('');
    expect(formatName(undefined)).toBe('');
  });
});

describe('rolLabel', () => {
  it.each([
    ['ASEGURADO', 'Asegurado'],
    ['PERITO', 'Perito'],
    ['TALLER', 'Taller'],
    ['ADMIN', 'Administrador'],
  ])('traduce %s a %s', (rol, esperado) => {
    expect(rolLabel(rol)).toBe(esperado);
  });

  it('devuelve cadena vacía sin rol', () => {
    expect(rolLabel(null)).toBe('');
    expect(rolLabel(undefined)).toBe('');
  });

  it('devuelve el valor original si el rol no es conocido', () => {
    expect(rolLabel('OTRO')).toBe('OTRO');
  });
});
