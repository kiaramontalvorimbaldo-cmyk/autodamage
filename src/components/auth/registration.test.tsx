import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegistroPage from '@/app/(auth)/registro/page';
const state = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  fetch: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: state.push, refresh: state.refresh }),
}));
vi.mock('sonner', () => ({ toast: { success: state.success, error: state.error } }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', state.fetch);
});
afterEach(() => vi.unstubAllGlobals());
function submit() {
  fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Ana Pérez' } });
  fireEvent.change(screen.getByLabelText('Correo electrónico'), {
    target: { value: 'ana@example.test' },
  });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'SoloPruebas123!' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Registrarme' }).closest('form')!);
}
it('debería mostrar confirmación sin enviar a un portal sin sesión', async () => {
  state.fetch.mockResolvedValue(new Response('{}', { status: 202 }));
  render(<RegistroPage />);
  submit();
  expect(await screen.findByRole('status')).toHaveTextContent('Revisa tu correo');
  expect(state.push).not.toHaveBeenCalled();
  expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login');
});
it('debería entrar al portal cuando el registro obtiene sesión', async () => {
  state.fetch.mockResolvedValue(new Response('{}', { status: 200 }));
  render(<RegistroPage />);
  submit();
  await waitFor(() => expect(state.push).toHaveBeenCalledWith('/asegurado'));
});
it('debería mostrar un error comprensible y rehabilitar el botón', async () => {
  state.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
  render(<RegistroPage />);
  submit();
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectarnos');
  expect(screen.getByRole('button', { name: 'Registrarme' })).toBeEnabled();
});
