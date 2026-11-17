import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaseCoordination } from './case-coordination';

const mock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-client', () => ({ apiFetch: mock }));
const siniestro = '00000000-0000-4000-8000-000000000001';
beforeEach(() => {
  mock.mockReset();
  mock.mockImplementation(async (_url: string, init?: { method: string }) =>
    init?.method === 'POST' ? { ok: true } : { fechaEntrega: null, mensajes: [], antes: null },
  );
});

it('permite al taller enviar un hallazgo en la conversación del caso', async () => {
  const user = userEvent.setup();
  render(<CaseCoordination siniestroId={siniestro} rol="TALLER" />);
  await user.type(
    await screen.findByLabelText('Mensaje para el perito'),
    'Encontré daño debajo del paragolpes',
  );
  await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
  await screen.findByText('Mensaje enviado.');
  expect(mock).toHaveBeenCalledWith(`/api/siniestros/${siniestro}/coordinacion`, {
    method: 'POST',
    body: {
      tipo: 'mensaje',
      id: expect.any(String),
      contenido: 'Encontré daño debajo del paragolpes',
    },
  });
});

it('conserva el texto y el identificador del intento cuando el envío falla', async () => {
  const user = userEvent.setup();
  mock.mockImplementation(async (_url: string, init?: { method: string }) => {
    if (init?.method === 'POST') throw new Error('Sin conexión');
    return { fechaEntrega: null, mensajes: [], antes: null };
  });
  render(<CaseCoordination siniestroId={siniestro} rol="TALLER" />);
  await user.type(await screen.findByLabelText('Mensaje para el perito'), 'Revisar el soporte');
  await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
  await screen.findByText('Sin conexión');
  expect(screen.getByLabelText('Mensaje para el perito')).toHaveValue('Revisar el soporte');
  await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
  const envios = mock.mock.calls.filter(([, init]) => init?.method === 'POST');
  expect(envios).toHaveLength(2);
  expect(envios[0][1].body.id).toBe(envios[1][1].body.id);
});

it('guarda la entrega con su valor anterior y el perito puede consultarla', async () => {
  const user = userEvent.setup();
  const view = render(<CaseCoordination siniestroId={siniestro} rol="TALLER" />);
  const input = await screen.findByLabelText('Entrega estimada');
  await user.type(input, '2026-12-20');
  await user.click(screen.getByRole('button', { name: 'Guardar fecha' }));
  await screen.findByText('Fecha estimada de entrega guardada.');
  expect(mock).toHaveBeenCalledWith(expect.any(String), {
    method: 'POST',
    body: { tipo: 'entrega', fecha: '2026-12-20', anterior: null },
  });
  view.unmount();
  mock.mockResolvedValue({ fechaEntrega: '2026-12-20', mensajes: [], antes: null });
  render(<CaseCoordination siniestroId={siniestro} rol="PERITO" />);
  await screen.findByText('20/12/2026');
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Guardar fecha' })).not.toBeInTheDocument(),
  );
});
