import { HAMMING_MAX_DUPLICADO } from '@/domain/config';
import { hammingDistanceHex } from './hash';
import { describe, expect, it } from 'vitest';

describe('hammingDistanceHex', () => {
  it('distancia 0 entre hashes iguales', () => {
    expect(hammingDistanceHex('abcdef0123456789', 'abcdef0123456789')).toBe(0);
  });

  it('distancia 1 cuando difiere un solo bit', () => {
    // '0' = 0000, '1' = 0001 → 1 bit
    expect(hammingDistanceHex('0000000000000000', '1000000000000000')).toBe(1);
  });

  it('distancia 4 cuando difiere un nibble completo', () => {
    // '0' = 0000, 'f' = 1111 → 4 bits
    expect(hammingDistanceHex('0000000000000000', 'f000000000000000')).toBe(4);
  });

  it('distancia 64 entre complementos totales', () => {
    expect(hammingDistanceHex('0000000000000000', 'ffffffffffffffff')).toBe(64);
  });

  it('acumula bits de varios nibbles (1+1+2+1 = 5)', () => {
    // 1^0=1 bit, 2^0=1 bit, 3^0=2 bits, 4^0=1 bit
    expect(hammingDistanceHex('0000000000000000', '1234000000000000')).toBe(5);
  });

  it('límite exacto en HAMMING_MAX_DUPLICADO (5) es duplicado', () => {
    const a = '0000000000000000';
    const c = '1234000000000000'; // exactamente 5 bits
    expect(hammingDistanceHex(a, c)).toBe(HAMMING_MAX_DUPLICADO);
    expect(hammingDistanceHex(a, c) <= HAMMING_MAX_DUPLICADO).toBe(true);
  });

  it('un bit por encima del límite no es duplicado', () => {
    const a = '0000000000000000';
    const c = '1234100000000000'; // 6 bits
    expect(hammingDistanceHex(a, c)).toBe(6);
    expect(hammingDistanceHex(a, c) <= HAMMING_MAX_DUPLICADO).toBe(false);
  });

  it('rechaza hashes de distinta longitud', () => {
    expect(() => hammingDistanceHex('abc', 'abcd')).toThrow('misma longitud');
  });

  it('rechaza caracteres no hexadecimales', () => {
    expect(() => hammingDistanceHex('zzzzzzzzzzzzzzzz', '0000000000000000')).toThrow('hexadecimal');
  });
});
