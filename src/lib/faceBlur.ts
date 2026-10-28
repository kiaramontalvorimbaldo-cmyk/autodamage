/**
 * Difuminado de rostros con MediaPipe FaceDetector.
 *
 * Política fail-closed: si el detector no carga o falla, la foto
 * NO se puede enviar (la función lanza y el componente ofrece reintentar).
 *
 * El detector se carga una única vez desde los archivos autohospedados
 * en `public/mediapipe/` (wasm + modelo blaze_face_short_range.tflite).
 */
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

/** Margen alrededor de cada rostro detectado (15 %). */
export const MARGEN_ROSTRO = 0.15;

const RUTA_MODELO = '/mediapipe/blaze_face_short_range.tflite';
const RUTA_WASM = '/mediapipe/wasm';

/** Rostro detectado (coordenadas en px del lienzo). */
export type Rostro = {
  x: number;
  y: number;
  ancho: number;
  alto: number;
};

/** Detector de rostros (interfaz mínima para facilitar pruebas). */
export interface DetectorRostros {
  detectar(canvas: HTMLCanvasElement): Rostro[];
}

/** Función que dibuja el difuminado sobre el lienzo (inyectable en pruebas). */
export type Difuminador = (canvas: HTMLCanvasElement, region: Rostro) => void;

let detector: DetectorRostros | null = null;
let cargaEnCurso: Promise<DetectorRostros> | null = null;

/**
 * Carga (una sola vez) el FaceDetector desde archivos locales.
 * Lanza si el modelo o el wasm no están disponibles (fail-closed).
 */
export async function cargarFaceDetector(): Promise<DetectorRostros> {
  if (detector) return detector;
  if (cargaEnCurso) return cargaEnCurso;

  cargaEnCurso = (async () => {
    const vision = await FilesetResolver.forVisionTasks(RUTA_WASM);
    const cargado = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: RUTA_MODELO,
        delegate: 'CPU',
      },
      runningMode: 'IMAGE',
      minDetectionConfidence: 0.5,
    });
    const adaptado: DetectorRostros = {
      detectar: (canvas: HTMLCanvasElement) => aRostros(cargado.detect(canvas).detections),
    };
    detector = adaptado;
    return adaptado;
  })();

  try {
    return await cargaEnCurso;
  } finally {
    cargaEnCurso = null;
  }
}

/** Adapta la salida de MediaPipe a nuestro tipo Rostro. */
export function aRostros(
  detecciones:
    | readonly {
        boundingBox?: { originX?: number; originY?: number; width?: number; height?: number };
      }[]
    | undefined,
): Rostro[] {
  if (!detecciones) return [];
  return detecciones
    .filter((d) => d.boundingBox && d.boundingBox.width && d.boundingBox.height)
    .map((d) => ({
      x: d.boundingBox!.originX ?? 0,
      y: d.boundingBox!.originY ?? 0,
      ancho: d.boundingBox!.width!,
      alto: d.boundingBox!.height!,
    }));
}

/**
 * Expande la región del rostro con el margen (15 %) y la limita
 * a los bordes del lienzo.
 */
export function calcularRegionConMargen(
  rostro: Rostro,
  anchoCanvas: number,
  altoCanvas: number,
  margen: number = MARGEN_ROSTRO,
): Rostro {
  const deltaAncho = rostro.ancho * margen;
  const deltaAlto = rostro.alto * margen;
  const x = Math.max(0, rostro.x - deltaAncho);
  const y = Math.max(0, rostro.y - deltaAlto);
  const ancho = Math.min(anchoCanvas - x, rostro.ancho + 2 * deltaAncho);
  const alto = Math.min(altoCanvas - y, rostro.alto + 2 * deltaAlto);
  return { x, y, ancho, alto };
}

/**
 * Pixela una región con un lienzo auxiliar; no depende de Canvas.filter,
 * que algunos navegadores ignoran. Un fallo impide enviar la captura.
 */
export const difuminarRegion: Difuminador = (canvas, region) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('LIENZO_NO_DISPONIBLE');
  const auxiliar = document.createElement('canvas');
  auxiliar.width = 8;
  auxiliar.height = 8;
  const reducido = auxiliar.getContext('2d');
  if (!reducido) throw new Error('LIENZO_NO_DISPONIBLE');
  reducido.drawImage(canvas, region.x, region.y, region.ancho, region.alto, 0, 0, 8, 8);
  ctx.save();
  try {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(auxiliar, 0, 0, 8, 8, region.x, region.y, region.ancho, region.alto);
  } finally {
    ctx.restore();
  }
};

/**
 * Aplica el difuminado a todos los rostros. Devuelve la cantidad
 * de regiones difuminadas.
 */
export function difuminarRostros(
  canvas: HTMLCanvasElement,
  rostros: Rostro[],
  difuminador: Difuminador = difuminarRegion,
): number {
  let difuminados = 0;
  for (const rostro of rostros) {
    const region = calcularRegionConMargen(rostro, canvas.width, canvas.height);
    difuminador(canvas, region);
    difuminados += 1;
  }
  return difuminados;
}

/**
 * Pipeline fail-closed: carga el detector, detecta rostros y los difumina.
 * Lanza si el detector no está disponible o falla (la foto no se envía).
 */
export async function procesarImagen(
  canvas: HTMLCanvasElement,
  cargarDetector: () => Promise<DetectorRostros> = cargarFaceDetector,
  difuminador: Difuminador = difuminarRegion,
): Promise<number> {
  const detectorRostros = await cargarDetector();
  const detecciones = detectorRostros.detectar(canvas);
  return difuminarRostros(canvas, detecciones, difuminador);
}
