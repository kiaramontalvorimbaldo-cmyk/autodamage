import { describe, expect, it } from 'vitest';
import { excedeUmbralGps, haversineMeters } from './geo';

describe('haversineMeters', () => {
  it('distancia 0 entre el mismo punto', () => {
    expect(
      haversineMeters(
        { latitud: 40.4168, longitud: -3.7038 },
        { latitud: 40.4168, longitud: -3.7038 },
      ),
    ).toBe(0);
  });

  it('1 grado de latitud ≈ 111 195 m', () => {
    const distancia = haversineMeters({ latitud: 0, longitud: 0 }, { latitud: 1, longitud: 0 });
    expect(distancia).toBeGreaterThan(111_000);
    expect(distancia).toBeLessThan(111_400);
  });

  it('0.001 grados de longitud en el ecuador ≈ 111 m', () => {
    const distancia = haversineMeters({ latitud: 0, longitud: 0 }, { latitud: 0, longitud: 0.001 });
    expect(distancia).toBeGreaterThan(100);
    expect(distancia).toBeLessThan(120);
  });

  it('Madrid → Barcelona ≈ 505 km', () => {
    const distancia = haversineMeters(
      { latitud: 40.4168, longitud: -3.7038 },
      { latitud: 41.3874, longitud: 2.1686 },
    );
    expect(distancia).toBeGreaterThan(500_000);
    expect(distancia).toBeLessThan(510_000);
  });

  it('simétrica: a→b igual que b→a', () => {
    const a = { latitud: 19.4326, longitud: -99.1332 };
    const b = { latitud: -34.6037, longitud: -58.3816 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 5);
  });
});

describe('excedeUmbralGps', () => {
  const siniestro = { latitud: 40.4168, longitud: -3.7038 };

  it('no excede cuando la imagen está a menos de 500 m', () => {
    const imagen = { latitud: 40.417, longitud: -3.7038 }; // ≈ 22 m
    expect(excedeUmbralGps(imagen, siniestro, null)).toBe(false);
  });

  it('excede cuando la imagen está a más de 500 m', () => {
    const imagen = { latitud: 40.421, longitud: -3.7038 }; // ≈ 465 m... usar más lejos
    const imagenLejos = { latitud: 40.422, longitud: -3.7038 }; // ≈ 578 m
    expect(excedeUmbralGps(imagenLejos, siniestro, null)).toBe(true);
    expect(excedeUmbralGps(imagen, siniestro, null)).toBe(false);
  });

  it('usa max(500, precision_gps_m) como umbral', () => {
    // ≈ 1110 m de distancia
    const imagen = { latitud: 40.4268, longitud: -3.7038 };
    // con precisión de 2000 m, 1110 m no excede
    expect(excedeUmbralGps(imagen, siniestro, 2000)).toBe(false);
    // con precisión de 100 m, el umbral sigue siendo 500 m → excede
    expect(excedeUmbralGps(imagen, siniestro, 100)).toBe(true);
  });

  it('una precisión GPS enorme relaja el umbral', () => {
    const imagen = { latitud: 40.4268, longitud: -3.7038 }; // ≈ 1110 m
    expect(excedeUmbralGps(imagen, siniestro, 5000)).toBe(false);
  });
});
