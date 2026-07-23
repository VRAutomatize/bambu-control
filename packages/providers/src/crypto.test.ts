import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptCredentials, encryptCredentials, openToken, sealToken } from './crypto.js';

const key = randomBytes(32).toString('base64');

describe('crypto de credenciais (AES-256-GCM)', () => {
  it('round-trip de texto', () => {
    const secret = 'senha-super-secreta';
    const enc = encryptCredentials(secret, key);
    expect(enc).not.toContain(secret);
    expect(decryptCredentials(enc, key)).toBe(secret);
  });

  it('round-trip de token estruturado', () => {
    const token = { accessToken: 'abc', refreshToken: 'def', expiresAt: 123 };
    const enc = sealToken(token, key);
    expect(openToken(enc, key)).toEqual(token);
  });

  it('envelopes diferentes para o mesmo texto (IV aleatório)', () => {
    expect(encryptCredentials('x', key)).not.toBe(encryptCredentials('x', key));
  });

  it('chave errada falha a autenticação (GCM)', () => {
    const enc = encryptCredentials('x', key);
    const other = randomBytes(32).toString('base64');
    expect(() => decryptCredentials(enc, other)).toThrow();
  });

  it('rejeita chave com tamanho inválido', () => {
    expect(() => encryptCredentials('x', 'dG9vc2hvcnQ=')).toThrow(/32 bytes/);
  });

  it('detecta adulteração (auth tag)', () => {
    const enc = encryptCredentials('x', key);
    const buf = Buffer.from(enc, 'base64');
    buf[buf.length - 1] = (buf[buf.length - 1] ?? 0) ^ 0xff; // corrompe o último byte
    expect(() => decryptCredentials(buf.toString('base64'), key)).toThrow();
  });
});
