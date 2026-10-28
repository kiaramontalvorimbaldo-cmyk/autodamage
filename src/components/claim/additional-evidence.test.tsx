import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdditionalEvidence } from './additional-evidence';
const mock = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/lib/api-client', async (orig) => ({
  ...(await orig<typeof import('@/lib/api-client')>()),
  apiFetch: mock.fetch,
}));
vi.mock('@/components/camera/CameraCapture', () => ({
  CameraCapture: ({
    onCaptura,
    deshabilitado,
  }: {
    onCaptura: (f: { blob: Blob; capturadaEn: string }) => void;
    deshabilitado: boolean;
  }) => (
    <button
      disabled={deshabilitado}
      onClick={() =>
        onCaptura({
          blob: new Blob(['foto'], { type: 'image/jpeg' }),
          capturadaEn: '2026-10-28T01:00:00Z',
        })
      }
    >
      Capturar prueba
    </button>
  ),
}));
const solicitud = {
  id: '00000000-0000-0000-0000-000000000001',
  observaciones: 'Foto del lateral',
  entregada: false,
  cantidadFotos: 0,
};
beforeEach(() => {
  mock.fetch.mockReset();
  mock.fetch.mockImplementation(async (_url: string, init?: { method?: string }) => {
    if (init?.method === 'POST') throw new TypeError('Failed to fetch');
    return { ampliacion: solicitud };
  });
});
describe('respuesta a una ampliación', () => {
  it('debería exigir una foto nueva y mostrar las instrucciones', async () => {
    render(<AdditionalEvidence id="caso" ampliacion />);
    expect(await screen.findByText('Foto del lateral')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar ampliación al perito' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Capturar prueba' }));
    expect(screen.getByRole('button', { name: 'Enviar ampliación al perito' })).toBeEnabled();
  });
  it('debería conservar el mismo identificador de foto al reintentar un fallo', async () => {
    render(<AdditionalEvidence id="caso" ampliacion />);
    await screen.findByText('Foto del lateral');
    await userEvent.click(screen.getByRole('button', { name: 'Capturar prueba' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enviar ampliación al perito' }));
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar ampliación al perito' }));
    await waitFor(() =>
      expect(mock.fetch.mock.calls.filter((c) => c[1]?.method === 'POST')).toHaveLength(2),
    );
    const calls = mock.fetch.mock.calls.filter((c) => c[1]?.method === 'POST');
    expect(calls[0][1].body.get('imagen_id')).toBe(calls[1][1].body.get('imagen_id'));
    expect(calls[0][1].body.get('ampliacion_id')).toBe(solicitud.id);
  });
  it('debería mostrar la entrega al perito sin permitir otra captura', async () => {
    mock.fetch.mockResolvedValue({
      ampliacion: { ...solicitud, entregada: true, cantidadFotos: 2 },
    });
    render(<AdditionalEvidence id="caso" ampliacion soloConsulta />);
    expect(await screen.findByText(/Ampliación entregada/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Capturar prueba' })).not.toBeInTheDocument();
  });
});
