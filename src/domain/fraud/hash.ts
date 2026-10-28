/**
 * Distancia de Hamming entre dos hashes hexadecimales de igual longitud
 * (dHash de 64 bits = 16 caracteres hexadecimales).
 */
export function hammingDistanceHex(a: string, b: string): number {
  if (a.length !== b.length) {
    throw new Error('Los hashes deben tener la misma longitud');
  }
  let distancia = 0;
  for (let i = 0; i < a.length; i++) {
    const nibbleA = parseInt(a[i], 16);
    const nibbleB = parseInt(b[i], 16);
    if (Number.isNaN(nibbleA) || Number.isNaN(nibbleB)) {
      throw new Error('Hash inválido: debe contener solo hexadecimal');
    }
    distancia += contarBits(nibbleA ^ nibbleB);
  }
  return distancia;
}

function contarBits(n: number): number {
  let cuenta = 0;
  while (n > 0) {
    cuenta += n & 1;
    n >>>= 1;
  }
  return cuenta;
}
