import { describe, expect, it } from 'vitest';
import { loginSchema, registroSchema } from './auth';

const loginValido = {
  email: 'usuario@correo.com',
  password: 'secreto123',
};

describe('loginSchema', () => {
  it('acepta credenciales válidas', () => {
    const resultado = loginSchema.safeParse(loginValido);
    expect(resultado.success).toBe(true);
  });

  it('rechaza un email inválido', () => {
    const resultado = loginSchema.safeParse({ ...loginValido, email: 'no-es-email' });
    expect(resultado.success).toBe(false);
  });

  it('rechaza una contraseña corta (menos de 6 caracteres)', () => {
    const resultado = loginSchema.safeParse({ ...loginValido, password: '12345' });
    expect(resultado.success).toBe(false);
  });

  it('rechaza campos vacíos', () => {
    expect(loginSchema.safeParse({ email: '', password: '' }).success).toBe(false);
    expect(loginSchema.safeParse({}).success).toBe(false);
  });
});

describe('registroSchema', () => {
  const registroValido = {
    nombreCompleto: 'Ana Pérez',
    email: 'ana@correo.com',
    password: 'secreto123',
  };

  it('acepta un registro válido', () => {
    expect(registroSchema.safeParse(registroValido).success).toBe(true);
  });

  it('rechaza un nombre vacío o de un solo carácter', () => {
    expect(registroSchema.safeParse({ ...registroValido, nombreCompleto: '' }).success).toBe(false);
    expect(registroSchema.safeParse({ ...registroValido, nombreCompleto: 'A' }).success).toBe(
      false,
    );
  });

  it('rechaza un email inválido', () => {
    expect(registroSchema.safeParse({ ...registroValido, email: 'correo-malo' }).success).toBe(
      false,
    );
  });

  it('rechaza una contraseña corta', () => {
    expect(registroSchema.safeParse({ ...registroValido, password: '123' }).success).toBe(false);
  });

  it('rechaza campos vacíos', () => {
    expect(registroSchema.safeParse({ nombreCompleto: '', email: '', password: '' }).success).toBe(
      false,
    );
  });
});
