import { it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseDevelopmentUserRepository } from './development-user-repository';
import type { DevelopmentUserInput } from '@/application/ports/development-user-repository';
const input: DevelopmentUserInput = {
  email: 'perito@example.test',
  password: 'SoloPruebas123!',
  nombre: 'Perito',
  rol: 'PERITO',
  numeroLicencia: 'LIC-1',
};
let listUsers = vi.fn(),
  createUser = vi.fn(),
  deleteUser = vi.fn(),
  from = vi.fn();
let repository: SupabaseDevelopmentUserRepository;
function query(result: unknown) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    update: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    insert: vi.fn().mockResolvedValue(result),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  return chain;
}
beforeEach(() => {
  listUsers = vi.fn();
  createUser = vi.fn();
  deleteUser = vi.fn();
  from = vi.fn();
  repository = new SupabaseDevelopmentUserRepository({
    auth: { admin: { listUsers, createUser, deleteUser } },
    from,
  } as unknown as SupabaseClient);
});
it('debería buscar también en páginas posteriores a las primeras doscientas cuentas', async () => {
  listUsers
    .mockResolvedValueOnce({
      data: {
        users: Array.from({ length: 200 }, (_, i) => ({
          id: String(i),
          email: 'otro' + i + '@example.test',
        })),
      },
      error: null,
    })
    .mockResolvedValueOnce({
      data: { users: [{ id: 'found', email: 'PERITO@example.test' }] },
      error: null,
    });
  from
    .mockReturnValueOnce(query({ data: { rol: 'PERITO' }, error: null }))
    .mockReturnValueOnce(query({ data: { id: 'staff' }, error: null }));
  expect(await repository.findExisting(input)).toEqual({
    usuarioId: 'found',
    rol: 'PERITO',
    personalCompleto: true,
  });
  expect(listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 200 });
});
it('debería devolver null cuando no existe y rechazar errores de listado', async () => {
  listUsers.mockResolvedValueOnce({ data: { users: [] }, error: null });
  expect(await repository.findExisting(input)).toBeNull();
  listUsers.mockResolvedValueOnce({ data: null, error: { message: 'privado' } });
  await expect(repository.findExisting(input)).rejects.toMatchObject({
    code: 'SEED_BUSQUEDA_FALLIDA',
  });
});
it('debería identificar perfiles incompletos sin escribir', async () => {
  listUsers.mockResolvedValue({ data: { users: [{ id: 'u1', email: input.email }] }, error: null });
  from
    .mockReturnValueOnce(query({ data: null, error: null }))
    .mockReturnValueOnce(query({ data: null, error: null }));
  expect(await repository.findExisting(input)).toMatchObject({
    rol: null,
    personalCompleto: false,
  });
  expect(createUser).not.toHaveBeenCalled();
});
it('debería comprobar el error al asignar rol y que exista la fila actualizada', async () => {
  from
    .mockReturnValueOnce(query({ data: null, error: { message: 'privado' } }))
    .mockReturnValueOnce(query({ data: null, error: null }))
    .mockReturnValueOnce(query({ data: { id: 'u1' }, error: null }));
  await expect(repository.setRole('u1', 'PERITO')).rejects.toMatchObject({
    code: 'SEED_ROL_FALLIDO',
  });
  await expect(repository.setRole('u1', 'PERITO')).rejects.toMatchObject({
    code: 'SEED_ROL_FALLIDO',
  });
  await expect(repository.setRole('u1', 'PERITO')).resolves.toBeUndefined();
});
it('debería crear Auth sin aceptar metadatos de rol', async () => {
  createUser.mockResolvedValueOnce({ data: { user: { id: 'new' } }, error: null });
  expect(await repository.createAuthUser(input)).toBe('new');
  expect(createUser.mock.calls[0][0].user_metadata).toEqual({ nombre_completo: 'Perito' });
  createUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'privado' } });
  await expect(repository.createAuthUser(input)).rejects.toMatchObject({
    code: 'SEED_AUTH_FALLIDA',
  });
});
it.each(['PERITO', 'TALLER'] as const)(
  'debería comprobar el error de ficha para %s',
  async (rol) => {
    const person: DevelopmentUserInput =
      rol === 'PERITO'
        ? input
        : {
            email: 'taller@example.test',
            password: 'SoloPruebas123!',
            nombre: 'Taller',
            rol: 'TALLER',
            nombreTaller: 'Taller Local',
          };
    from.mockReturnValue(query({ error: { message: 'privado' } }));
    await expect(repository.createStaff('u1', person)).rejects.toMatchObject({
      code: 'SEED_PERSONAL_FALLIDO',
    });
  },
);
it('debería informar errores de eliminación en vez de ocultarlos', async () => {
  deleteUser
    .mockResolvedValueOnce({ error: { message: 'privado' } })
    .mockResolvedValueOnce({ error: null });
  await expect(repository.deleteCreatedAuthUser('new')).rejects.toMatchObject({
    code: 'SEED_REVERSION_FALLIDA',
  });
  await expect(repository.deleteCreatedAuthUser('new')).resolves.toBeUndefined();
});
