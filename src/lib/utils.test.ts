import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('combina clases', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('ignora valores falsy', () => {
    const falso = false;
    expect(cn('a', falso && 'b', undefined, 'c')).toBe('a c');
  });

  it('resuelve conflictos de Tailwind (la última gana)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
  });

  it('acepta clases condicionales', () => {
    const activo = true;
    expect(cn('base', activo && 'activo')).toBe('base activo');
  });
});
