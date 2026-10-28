import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const state = vi.hoisted(() => ({
  repository: {
    findExisting: vi.fn(),
    createAuthUser: vi.fn(),
    setRole: vi.fn(),
    createStaff: vi.fn(),
    deleteCreatedAuthUser: vi.fn(),
  },
  factory: vi.fn(),
}));
vi.mock('../../scripts/lib/load-env', () => ({
  loadEnvLocal: vi.fn(),
  requireEnv: (name: string) => 'test-' + name,
}));
vi.mock('../../src/infrastructure/supabase/development-user-repository', () => ({
  developmentUserRepository: state.factory,
}));
const originalArgv = process.argv;
const originalExit = process.exitCode;
const keys = [
  'DEV_ASEGURADO_PASSWORD',
  'DEV_PERITO_PASSWORD',
  'DEV_TALLER_1_PASSWORD',
  'DEV_TALLER_2_PASSWORD',
  'DEV_ADMIN_PASSWORD',
];
let log: ReturnType<typeof vi.spyOn>;
let errorLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  for (const key of keys) vi.stubEnv(key, 'ClaveSoloEnPruebas123!');
  process.exitCode = undefined;
  process.argv = [originalArgv[0], 'scripts/seed-dev-users.ts'];
  log = vi.spyOn(console, 'log').mockImplementation(() => {});
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  state.repository.findExisting.mockResolvedValue(null);
  state.repository.createAuthUser.mockResolvedValue('new');
  state.repository.setRole.mockResolvedValue(undefined);
  state.repository.createStaff.mockResolvedValue(undefined);
  state.repository.deleteCreatedAuthUser.mockResolvedValue(undefined);
  state.factory.mockReturnValue(state.repository);
});
afterEach(() => {
  process.argv = originalArgv;
  process.exitCode = originalExit;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
async function run(args: string[] = []) {
  process.argv = [originalArgv[0], 'scripts/seed-dev-users.ts', ...args];
  await import('../../scripts/seed-dev-users');
}
it('debería mostrar solo el plan por defecto sin conectar ni imprimir contraseñas', async () => {
  await run();
  expect(state.factory).not.toHaveBeenCalled();
  expect(log.mock.calls.flat().join(' ')).toContain('Plan únicamente');
  expect(log.mock.calls.flat().join(' ')).not.toContain('ClaveSoloEnPruebas123!');
});
it('debería permitir revisar el plan aunque falten contraseñas', async () => {
  for (const key of keys) vi.stubEnv(key, '');
  await run(['--plan']);
  expect(state.factory).not.toHaveBeenCalled();
  expect(log.mock.calls.flat().join(' ')).toContain('pendiente');
});
it('debería validar el lote antes de inicializar un adaptador de escritura', async () => {
  vi.stubEnv('DEV_ADMIN_PASSWORD', '');
  await run(['--apply']);
  await vi.waitFor(() => expect(process.exitCode).toBe(1));
  expect(state.factory).not.toHaveBeenCalled();
  expect(errorLog).toHaveBeenCalled();
});
it('debería crear el lote solo con apply explícito y avisar al terminar', async () => {
  await run(['--apply']);
  await vi.waitFor(() => expect(state.repository.setRole).toHaveBeenCalledTimes(5));
  await vi.waitFor(() => expect(log.mock.calls.flat().join(' ')).toContain('Todas las cuentas'));
  expect(state.repository.createStaff).toHaveBeenCalledTimes(3);
  expect(process.exitCode).toBeUndefined();
});
it('debería detener el lote y revertir cuando falla la primera cuenta', async () => {
  state.repository.setRole.mockRejectedValue(new Error('detalle privado'));
  await run(['--apply']);
  await vi.waitFor(() => expect(process.exitCode).toBe(1));
  expect(state.repository.createAuthUser).toHaveBeenCalledOnce();
  expect(state.repository.deleteCreatedAuthUser).toHaveBeenCalledWith('new');
  expect(log.mock.calls.flat().join(' ')).not.toContain('Todas las cuentas');
  expect(errorLog.mock.calls.flat().join(' ')).not.toContain('detalle privado');
});
it('debería rechazar opciones inesperadas sin iniciar operaciones', async () => {
  await run(['--reset']);
  await vi.waitFor(() => expect(process.exitCode).toBe(1));
  expect(state.factory).not.toHaveBeenCalled();
});
