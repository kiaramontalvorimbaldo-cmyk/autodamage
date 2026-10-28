import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { requerirSesion, respuestaSinPermiso } from './session';
import { AppError } from './errors';
const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock('@/lib/auth/require-user', () => ({ requireUser }));
beforeEach(() => vi.clearAllMocks());
describe('sesión de los handlers', () => {
  it('debería permitir el rol autorizado', async () => {
    requireUser.mockResolvedValue({ usuarioId: 'u1', nombre: 'Ana', rol: 'ADMIN' });
    await expect(requerirSesion(new NextRequest('http://localhost'), ['ADMIN'])).resolves.toEqual({
      sesion: { usuarioId: 'u1', rol: 'ADMIN' },
    });
  });
  it('debería rechazar roles distintos', async () => {
    requireUser.mockResolvedValue({ usuarioId: 'u1', nombre: 'Ana', rol: 'ASEGURADO' });
    const result = await requerirSesion(new NextRequest('http://localhost'), ['ADMIN']);
    expect('respuesta' in result && result.respuesta.status).toBe(403);
  });
  it.each([401, 403])('debería exigir sesión cuando no está autorizada %s', async (status) => {
    requireUser.mockRejectedValue(new AppError('NO_AUTENTICADO', status));
    const result = await requerirSesion(new NextRequest('http://localhost'));
    expect('respuesta' in result && result.respuesta.status).toBe(401);
  });
  it('debería propagar fallos de infraestructura', async () => {
    requireUser.mockRejectedValue(new Error('db'));
    await expect(requerirSesion(new NextRequest('http://localhost'))).rejects.toThrow('db');
    expect(respuestaSinPermiso().status).toBe(403);
  });
});
