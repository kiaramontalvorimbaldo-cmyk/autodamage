'use client';

import { useEffect, useRef, useState } from 'react';

export type UsePollingOptions<T> = {
  /** Función que consulta el estado. */
  consultar: () => Promise<T>;
  /** Intervalo en ms (por defecto 3000). */
  intervaloMs?: number;
  /** Tiempo máximo de sondeo en ms (por defecto 120000 = 2 min). */
  maxMs?: number;
  /** Se considera terminal (deja de sondear). */
  esTerminal: (valor: T) => boolean;
  /** Se ejecuta en cada valor recibido. */
  onChange?: (valor: T) => void;
};

export type UsePollingResult<T> = {
  valor: T | null;
  error: Error | null;
  /** True cuando dejó de sondear por terminal, tiempo máximo o error. */
  detenido: boolean;
  razonDetencion: 'terminal' | 'tiempo' | 'error' | null;
};

/**
 * Sondeo periódico (polling) que se detiene cuando:
 * - el valor es terminal (esTerminal),
 * - se supera el tiempo máximo,
 * - o la consulta falla.
 */
export function usePolling<T>({
  consultar,
  intervaloMs = 3000,
  maxMs = 120_000,
  esTerminal,
  onChange,
}: UsePollingOptions<T>): UsePollingResult<T> {
  const [valor, setValor] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [razonDetencion, setRazonDetencion] = useState<'terminal' | 'tiempo' | 'error' | null>(
    null,
  );

  const consultarRef = useRef(consultar);
  const esTerminalRef = useRef(esTerminal);
  const onChangeRef = useRef(onChange);
  consultarRef.current = consultar;
  esTerminalRef.current = esTerminal;
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelado = false;
    const inicio = Date.now();
    let siguiente: number | undefined;
    const plazo = window.setTimeout(() => {
      cancelado = true;
      window.clearTimeout(siguiente);
      setRazonDetencion('tiempo');
    }, maxMs);

    const sondear = async () => {
      if (cancelado) return;
      try {
        const resultado = await consultarRef.current();
        if (cancelado) return;
        setValor(resultado);
        setError(null);
        onChangeRef.current?.(resultado);
        if (esTerminalRef.current(resultado)) {
          cancelado = true;
          window.clearTimeout(plazo);
          setRazonDetencion('terminal');
          return;
        }
        if (Date.now() - inicio >= maxMs) {
          cancelado = true;
          window.clearTimeout(plazo);
          setRazonDetencion('tiempo');
          return;
        }
        siguiente = window.setTimeout(sondear, intervaloMs);
      } catch (e) {
        if (cancelado) return;
        cancelado = true;
        window.clearTimeout(plazo);
        setError(e instanceof Error ? e : new Error('Error de sondeo'));
        setRazonDetencion('error');
      }
    };

    void sondear();
    return () => {
      cancelado = true;
      window.clearTimeout(plazo);
      window.clearTimeout(siguiente);
    };
  }, [intervaloMs, maxMs]);

  return { valor, error, detenido: razonDetencion !== null, razonDetencion };
}
