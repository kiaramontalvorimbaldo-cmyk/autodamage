import { it, expect, vi, beforeEach } from 'vitest';
import { requirePortalUser } from './require-portal-user';
import { AppError } from '@/lib/errors';
const { requireUser, redirect } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error('redirect:' + url);
  }),
}));
vi.mock('./require-user', () => ({ requireUser }));
vi.mock('next/navigation', () => ({ redirect }));
beforeEach(() => vi.clearAllMocks());
it('debería admitir al administrador en su portal', async () => {
  const user = { usuarioId: 'u1', nombre: 'Ana', rol: 'ADMIN' };
  requireUser.mockResolvedValue(user);
  await expect(requirePortalUser('ADMIN')).resolves.toBe(user);
});
it('debería enviar al administrador a admin al abrir otro portal', async () => {
  requireUser.mockResolvedValue({ usuarioId: 'u1', nombre: 'Ana', rol: 'ADMIN' });
  await expect(requirePortalUser('PERITO')).rejects.toThrow('redirect:/admin');
});
it('debería proteger el portal sin sesión', async () => {
  requireUser.mockRejectedValue(new AppError('NO_AUTENTICADO', 401));
  await expect(requirePortalUser('ADMIN')).rejects.toThrow('redirect:/login');
});
it('debería propagar fallos inesperados', async () => {
  requireUser.mockRejectedValue(new Error('failure'));
  await expect(requirePortalUser('ADMIN')).rejects.toThrow('failure');
});
