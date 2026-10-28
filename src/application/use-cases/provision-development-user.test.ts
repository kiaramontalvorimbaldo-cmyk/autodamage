import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provisionDevelopmentUser } from './provision-development-user';
import { AppError } from '@/lib/errors';
import type { DevelopmentUserInput } from '../ports/development-user-repository';
function repository() {
  return {
    findExisting: vi.fn().mockResolvedValue(null),
    createAuthUser: vi.fn().mockResolvedValue('new-user'),
    setRole: vi.fn().mockResolvedValue(undefined),
    createStaff: vi.fn().mockResolvedValue(undefined),
    deleteCreatedAuthUser: vi.fn().mockResolvedValue(undefined),
  };
}
let repo = repository();
beforeEach(() => {
  repo = repository();
});
const perito: DevelopmentUserInput = {
  email: 'perito@example.test',
  nombre: 'Perito Local',
  password: 'SoloPruebas123!',
  rol: 'PERITO',
  numeroLicencia: 'LIC-LOCAL',
};
describe('provisionDevelopmentUser', () => {
  it('debería crear el usuario, asignar su rol y crear la ficha', async () => {
    expect(await provisionDevelopmentUser(repo, perito)).toMatchObject({
      usuarioId: 'new-user',
      rol: 'PERITO',
      estado: 'CREADO',
    });
    expect(repo.setRole).toHaveBeenCalledWith('new-user', 'PERITO');
    expect(repo.createStaff).toHaveBeenCalledWith('new-user', perito);
    expect(repo.deleteCreatedAuthUser).not.toHaveBeenCalled();
  });
  it.each(['ASEGURADO', 'ADMIN'] as const)(
    'debería crear %s sin una ficha de personal',
    async (rol) => {
      await provisionDevelopmentUser(repo, {
        email: 'local@example.test',
        nombre: 'Local',
        password: 'SoloPruebas123!',
        rol,
      });
      expect(repo.createStaff).not.toHaveBeenCalled();
    },
  );
  it.each(['setRole', 'createStaff'] as const)(
    'debería revertir la cuenta nueva si falla %s',
    async (step) => {
      repo[step].mockRejectedValue(new AppError('FALLO', 500));
      await expect(provisionDevelopmentUser(repo, perito)).rejects.toMatchObject({ code: 'FALLO' });
      expect(repo.deleteCreatedAuthUser).toHaveBeenCalledWith('new-user');
    },
  );
  it('debería conservar una cuenta existente completa sin cambiarla', async () => {
    repo.findExisting.mockResolvedValue({
      usuarioId: 'existing',
      rol: 'PERITO',
      personalCompleto: true,
    });
    expect((await provisionDevelopmentUser(repo, perito)).estado).toBe('EXISTENTE');
    expect(repo.createAuthUser).not.toHaveBeenCalled();
    expect(repo.setRole).not.toHaveBeenCalled();
    expect(repo.deleteCreatedAuthUser).not.toHaveBeenCalled();
  });
  it.each([
    { rol: 'ASEGURADO', personalCompleto: true },
    { rol: 'PERITO', personalCompleto: false },
    { rol: null, personalCompleto: true },
  ])('debería rechazar una cuenta existente incompatible sin borrarla', async (existing) => {
    repo.findExisting.mockResolvedValue({ usuarioId: 'existing', ...existing });
    await expect(provisionDevelopmentUser(repo, perito)).rejects.toMatchObject({
      code: 'SEED_EXISTENTE_INCOMPATIBLE',
    });
    expect(repo.deleteCreatedAuthUser).not.toHaveBeenCalled();
    expect(repo.setRole).not.toHaveBeenCalled();
  });
  it('debería informar si también falla la reversión', async () => {
    repo.setRole.mockRejectedValue(new Error('fallo'));
    repo.deleteCreatedAuthUser.mockRejectedValue(new Error('fallo'));
    await expect(provisionDevelopmentUser(repo, perito)).rejects.toMatchObject({
      code: 'SEED_REVERSION_FALLIDA',
      details: { usuarioId: 'new-user' },
    });
  });
  it('debería ocultar un fallo inesperado después de revertir', async () => {
    repo.setRole.mockRejectedValue(new Error('dato interno privado'));
    await expect(provisionDevelopmentUser(repo, perito)).rejects.toMatchObject({
      code: 'SEED_CREACION_FALLIDA',
    });
  });
  it('debería detenerse sin intentar eliminar si no se creó la cuenta', async () => {
    repo.createAuthUser.mockRejectedValue(new AppError('SEED_AUTH_FALLIDA', 500));
    await expect(provisionDevelopmentUser(repo, perito)).rejects.toMatchObject({
      code: 'SEED_AUTH_FALLIDA',
    });
    expect(repo.deleteCreatedAuthUser).not.toHaveBeenCalled();
  });
  it('debería detenerse sin crear nada si falla la consulta inicial', async () => {
    repo.findExisting.mockRejectedValue(new Error('fallo'));
    await expect(provisionDevelopmentUser(repo, perito)).rejects.toThrow('fallo');
    expect(repo.createAuthUser).not.toHaveBeenCalled();
  });
});
