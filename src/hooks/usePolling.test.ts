import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePolling } from './usePolling';

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debería respetar el plazo aunque una consulta quede pendiente e ignorar su respuesta tardía', async () => {
    let completar!: (valor: string) => void;
    const consultar = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          completar = resolve;
        }),
    );
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      usePolling({ consultar, maxMs: 6000, esTerminal: () => true, onChange }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(result.current.razonDetencion).toBe('tiempo');
    await act(async () => {
      completar('tardío');
    });
    expect(result.current.valor).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('debería limpiar los temporizadores al desmontar', async () => {
    const { unmount } = renderHook(() =>
      usePolling({ consultar: async () => 'pendiente', esTerminal: () => false }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('debería sondear hasta recibir un valor terminal', async () => {
    const consultar = vi
      .fn()
      .mockResolvedValueOnce('EN_PROCESO')
      .mockResolvedValueOnce('EN_PROCESO')
      .mockResolvedValueOnce('COMPLETADO');

    const { result } = renderHook(() =>
      usePolling({
        consultar,
        intervaloMs: 3000,
        esTerminal: (v) => v === 'COMPLETADO' || v === 'FALLIDO',
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.valor).toBe('EN_PROCESO');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(result.current.valor).toBe('EN_PROCESO');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(result.current.valor).toBe('COMPLETADO');
    expect(result.current.detenido).toBe(true);
    expect(result.current.razonDetencion).toBe('terminal');

    // No sondear más después del valor terminal.
    const llamadas = consultar.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(consultar.mock.calls.length).toBe(llamadas);
  });

  it('debería detenerse al superar el tiempo máximo', async () => {
    const consultar = vi.fn().mockResolvedValue('EN_PROCESO');

    const { result } = renderHook(() =>
      usePolling({
        consultar,
        intervaloMs: 3000,
        maxMs: 6000,
        esTerminal: (v) => v === 'COMPLETADO',
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(result.current.detenido).toBe(true);
    expect(result.current.razonDetencion).toBe('tiempo');
    const llamadas = consultar.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(consultar.mock.calls.length).toBe(llamadas);
  });

  it('debería detenerse con error si la consulta falla', async () => {
    const consultar = vi.fn().mockRejectedValue(new Error('RED'));

    const { result } = renderHook(() =>
      usePolling({
        consultar,
        intervaloMs: 3000,
        esTerminal: () => false,
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('RED');
    expect(result.current.detenido).toBe(true);
    expect(result.current.razonDetencion).toBe('error');
  });

  it('debería notificar cada valor a onChange', async () => {
    const consultar = vi.fn().mockResolvedValueOnce('A').mockResolvedValueOnce('B');
    const onChange = vi.fn();

    renderHook(() =>
      usePolling({
        consultar,
        intervaloMs: 1000,
        esTerminal: (v) => v === 'B',
        onChange,
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(onChange).toHaveBeenNthCalledWith(1, 'A');
    expect(onChange).toHaveBeenNthCalledWith(2, 'B');
  });
});
