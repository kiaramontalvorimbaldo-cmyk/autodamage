import { describe, it, expect, vi, beforeEach } from 'vitest';
import { obtenerPerfilActual } from './perfil';
import { AppError } from '@/lib/errors';
const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock('@/lib/auth/require-user', () => ({ requireUser }));
beforeEach(() => vi.clearAllMocks());
describe('obtenerPerfilActual', () => {
  it('debería reutilizar la identidad validada', async () => {
    requireUser.mockResolvedValue({ usuarioId: 'u1', nombre: 'kiara montalvo', rol: 'ASEGURADO' });
    await expect(obtenerPerfilActual()).resolves.toEqual({
      nombre: 'kiara montalvo',
      rol: 'ASEGURADO',
    });
  });
  it.each([401, 403])('debería devolver null ante acceso denegado %s', async (status) => {
    requireUser.mockRejectedValue(new AppError('NO_AUTENTICADO', status));
    await expect(obtenerPerfilActual()).resolves.toBeNull();
  });
  it('debería propagar fallos inesperados', async () => {
    requireUser.mockRejectedValue(new Error('fallo'));
    await expect(obtenerPerfilActual()).rejects.toThrow('fallo');
  });
});
