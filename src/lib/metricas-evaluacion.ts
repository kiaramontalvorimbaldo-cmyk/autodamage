export type Prediccion = {
  severidad: string;
  piezas: string[];
  esRecaptura: boolean;
};

export type Etiqueta = {
  archivo: string;
  severidad: string;
  piezas: string[];
  esRecaptura: boolean;
};

/** Métricas del set de validación (precisión, exhaustividad, F1, matriz). */
export function metricasSeveridad(
  reales: Etiqueta[],
  predichas: Prediccion[],
): { aciertos: number; total: number; matriz: Record<string, Record<string, number>> } {
  const matriz: Record<string, Record<string, number>> = {};
  let aciertos = 0;
  for (let i = 0; i < reales.length; i += 1) {
    const real = reales[i].severidad;
    const pred = predichas[i]?.severidad ?? 'SIN_RESPUESTA';
    matriz[real] ??= {};
    matriz[real][pred] = (matriz[real][pred] ?? 0) + 1;
    if (pred === real) aciertos += 1;
  }
  return { aciertos, total: reales.length, matriz };
}

export function metricasPiezas(
  reales: Etiqueta[],
  predichas: Prediccion[],
): { precision: number; recall: number; f1: number } {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (let i = 0; i < reales.length; i += 1) {
    const esperadas = new Set(reales[i].piezas);
    const detectadas = new Set(predichas[i]?.piezas ?? []);
    for (const d of detectadas) {
      if (esperadas.has(d)) tp += 1;
      else fp += 1;
    }
    for (const e of esperadas) {
      if (!detectadas.has(e)) fn += 1;
    }
  }
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
}

export function metricasRecaptura(
  reales: Etiqueta[],
  predichas: Prediccion[],
): { vp: number; fp: number; vn: number; fn: number } {
  let vp = 0;
  let fp = 0;
  let vn = 0;
  let fn = 0;
  for (let i = 0; i < reales.length; i += 1) {
    const real = reales[i].esRecaptura;
    const pred = predichas[i]?.esRecaptura ?? false;
    if (real && pred) vp += 1;
    else if (!real && pred) fp += 1;
    else if (!real && !pred) vn += 1;
    else fn += 1;
  }
  return { vp, fp, vn, fn };
}

export function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const indice = Math.ceil((p / 100) * ordenados.length) - 1;
  return ordenados[Math.max(0, indice)];
}
