import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { EvidenceImage } from './evidence-image';
it('debería explicar la evidencia fallida y recuperar una URL renovada', () => {
  const { rerender } = render(<EvidenceImage src="/caducada.jpg" />);
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByRole('status')).toHaveTextContent('No se pudo cargar');
  rerender(<EvidenceImage src="/renovada.jpg" />);
  expect(screen.getByRole('img')).toHaveAttribute('src', '/renovada.jpg');
});
