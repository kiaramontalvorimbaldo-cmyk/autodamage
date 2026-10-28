import { describe, expect, it } from 'vitest';
import { esRutaDelPortal, esRutaProtegida, portalPorRol, esRol } from './portal-routes';

describe('rutas de los portales', () => {
  it('reconoce las páginas principales y anidadas como protegidas', () => {
    expect(esRutaProtegida('/asegurado')).toBe(true);
    expect(esRutaProtegida('/asegurado/nuevo-siniestro')).toBe(true);
    expect(esRutaProtegida('/perito/siniestros/123')).toBe(true);
    expect(esRutaProtegida('/taller/ordenes')).toBe(true);
    expect(esRutaProtegida('/aseguradono-valido')).toBe(false);
    expect(esRutaProtegida('/login')).toBe(false);
  });

  it('permite navegar por todo el portal asignado, no por otro portal', () => {
    expect(esRutaDelPortal('/asegurado', '/asegurado')).toBe(true);
    expect(esRutaDelPortal('/asegurado/nuevo-siniestro', '/asegurado')).toBe(true);
    expect(esRutaDelPortal('/asegurado/siniestros', '/asegurado')).toBe(true);
    expect(esRutaDelPortal('/perito', '/asegurado')).toBe(false);
    expect(esRutaDelPortal('/aseguradono-valido', '/asegurado')).toBe(false);
  });
});

it('debería proteger admin y resolver su portal correcto', () => {
  expect(esRutaProtegida('/admin')).toBe(true);
  expect(esRutaProtegida('/admin/personal')).toBe(true);
  expect(portalPorRol('ADMIN')).toBe('/admin');
  expect(esRol('ADMIN')).toBe(true);
  expect(esRol('toString')).toBe(false);
  expect(esRol(null)).toBe(false);
});
