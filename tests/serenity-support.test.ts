import { mkdtempSync, mkdirSync, writeFileSync, rmSync, rmdirSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { findMaven, createDependencyHandler } from '../scripts/ci/serenity-support.mjs';

describe('preparación de Serenity sin servicios reales', () => {
  it('debería exigir Maven sin inventar una instalación', () => {
    expect(() => findMaven({ PATH: '' })).toThrow('No se encontró Maven');
  });

  it('debería localizar Maven mediante MAVEN_HOME, incluso si la carpeta tiene espacios', () => {
    // El directorio temporal de Windows puede contener metacaracteres que cmd rechaza.
    const dir = mkdtempSync(join(process.cwd(), 'autodamage maven '));
    const bin = join(dir, 'bin');
    const executable = join(bin, process.platform === 'win32' ? 'mvn.cmd' : 'mvn');
    mkdirSync(bin);
    try {
      writeFileSync(executable, '');
      expect(findMaven({ MAVEN_HOME: dir, PATH: '' })).toBe(executable);
    } finally {
      rmSync(executable, { force: true });
      rmdirSync(bin);
      rmdirSync(dir);
    }
  });

  it('debería simular disponibilidad y bloquear operaciones de datos no previstas', () => {
    const { handler, unexpected } = createDependencyHandler();

    function post(url: string) {
      const request = { method: 'POST', url, resume: vi.fn() };
      const response = {
        setHeader: vi.fn(),
        writeHead: vi.fn().mockReturnThis(),
        end: vi.fn(),
      };
      handler(request as unknown as IncomingMessage, response as unknown as ServerResponse);
      expect(request.resume).toHaveBeenCalledOnce();
      expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      return { status: response.writeHead.mock.calls[0][0], body: response.end.mock.calls[0][0] };
    }

    expect(post('/rest/v1/rpc/ping')).toEqual({ status: 200, body: '1' });
    expect(post('/modo/indisponible').status).toBe(204);
    expect(post('/rest/v1/rpc/ping').status).toBe(503);
    expect(post('/modo/disponible').status).toBe(204);
    expect(post('/rest/v1/rpc/ping')).toEqual({ status: 200, body: '1' });
    expect(post('/auth/v1/token?grant_type=password').status).toBe(400);
    expect(post('/rest/v1/usuarios').status).toBe(500);
    expect(unexpected).toEqual(['POST /rest/v1/usuarios']);
  });
});
