import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, it, expect, vi } from 'vitest';
import { PrintReport } from './print-report';
afterEach(() => vi.restoreAllMocks());
it('debería impedir imprimir un expediente con una evidencia que no cargó', async () => {
  const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {});
  render(
    <>
      <article className="insurance-report">
        <img src="/sin-evidencia.jpg" alt="Evidencia" />
      </article>
      <PrintReport />
    </>,
  );
  fireEvent.click(screen.getByRole('button', { name: /Guardar PDF/ }));
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('Hay evidencias que no cargaron'),
  );
  expect(imprimir).not.toHaveBeenCalled();
});
it('debería permitir guardar como PDF un expediente pendiente sin fotografías', async () => {
  const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {});
  render(
    <>
      <article className="insurance-report" />
      <PrintReport />
    </>,
  );
  fireEvent.click(screen.getByRole('button', { name: /Guardar PDF/ }));
  await waitFor(() => expect(imprimir).toHaveBeenCalledOnce());
});
