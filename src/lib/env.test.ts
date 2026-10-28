import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const baseEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://xyzcompany.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  GEMINI_API_KEY: 'gemini-key',
  GEMINI_MODEL: 'gemini-2.0-flash',
  AI_PROVIDER: 'mock',
  DAILY_AI_QUOTA_LIMIT: '200',
  AI_MAX_RPM: '10',
};

describe('parseEnv', () => {
  it('acepta una configuración válida y parsea números', () => {
    const env = parseEnv(baseEnv);
    expect(env.AI_PROVIDER).toBe('mock');
    expect(env.DAILY_AI_QUOTA_LIMIT).toBe(200);
    expect(env.AI_MAX_RPM).toBe(10);
  });

  it.each([
    ['NEXT_PUBLIC_SUPABASE_URL'],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    ['SUPABASE_SERVICE_ROLE_KEY'],
    ['GEMINI_API_KEY'],
    ['GEMINI_MODEL'],
    ['AI_PROVIDER'],
    ['DAILY_AI_QUOTA_LIMIT'],
    ['AI_MAX_RPM'],
  ])('falla cuando falta la variable %s', (clave) => {
    const sinClave = { ...baseEnv, [clave]: undefined };
    expect(() => parseEnv(sinClave)).toThrow(/Variables de entorno inválidas/);
  });

  it('solo admite gemini o mock en AI_PROVIDER', () => {
    expect(() => parseEnv({ ...baseEnv, AI_PROVIDER: 'otro' })).toThrow(/AI_PROVIDER/);
  });

  it('rechaza una URL de Supabase inválida', () => {
    expect(() => parseEnv({ ...baseEnv, NEXT_PUBLIC_SUPABASE_URL: 'no-es-url' })).toThrow(
      /Supabase/,
    );
  });

  it('rechaza cuotas que no son números enteros', () => {
    expect(() => parseEnv({ ...baseEnv, DAILY_AI_QUOTA_LIMIT: 'abc' })).toThrow();
    expect(() => parseEnv({ ...baseEnv, AI_MAX_RPM: '0' })).toThrow();
  });
});
