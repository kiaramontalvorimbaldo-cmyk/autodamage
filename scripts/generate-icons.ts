import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { resolve } from 'node:path';

/**
 * Genera los íconos PWA (192 y 512 px) como PNG sólidos de marca.
 * Se ejecuta una vez: `npx tsx scripts/generate-icons.ts`
 * (evita depender de binarios de imagen para un activo de placeholder).
 */

const BRAND = { r: 0x25, g: 0x63, b: 0xeb }; // #2563eb

let crcTable: Int32Array | undefined;

function crc32(buffer: Buffer): number {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function pngChunk(tipo: string, datos: Buffer): Buffer {
  const longitud = Buffer.alloc(4);
  longitud.writeUInt32BE(datos.length);
  const tipoBuffer = Buffer.from(tipo, 'ascii');
  const crcInput = Buffer.concat([tipoBuffer, datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([longitud, tipoBuffer, datos, crc]);
}

function makePng(size: number, color: { r: number; g: number; b: number }): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profundidad de bits
  ihdr[9] = 2; // tipo de color: RGB truecolor

  const rowLength = 1 + size * 3;
  const raw = Buffer.alloc(rowLength * size);
  for (let y = 0; y < size; y++) {
    const offset = y * rowLength;
    raw[offset] = 0; // filtro: ninguno
    for (let x = 0; x < size; x++) {
      const p = offset + 1 + x * 3;
      raw[p] = color.r;
      raw[p + 1] = color.g;
      raw[p + 2] = color.b;
    }
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const publicDir = resolve(process.cwd(), 'public/icons');
mkdirSync(publicDir, { recursive: true });

writeFileSync(resolve(publicDir, 'icon-192.png'), makePng(192, BRAND));
writeFileSync(resolve(publicDir, 'icon-512.png'), makePng(512, BRAND));

console.log('Íconos generados en public/icons/ (icon-192.png, icon-512.png)');
