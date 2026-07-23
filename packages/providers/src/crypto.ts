/**
 * Criptografia autenticada de credenciais de integração (AES-256-GCM).
 * Usada SOMENTE server-side (Route Handlers / worker). O texto cifrado é o
 * único formato que chega ao banco. A senha original NUNCA é persistida.
 *
 * Formato do envelope (base64): iv(12) | authTag(16) | ciphertext.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

function loadKey(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `CREDENTIALS_ENCRYPTION_KEY deve ter 32 bytes em base64 (tem ${key.length}). ` +
        'Gere com: openssl rand -base64 32',
    );
  }
  return key;
}

/** Criptografa um objeto de credenciais em um envelope base64. */
export function encryptCredentials(plaintext: string, keyBase64: string): string {
  const key = loadKey(keyBase64);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/** Descriptografa um envelope base64 produzido por encryptCredentials. */
export function decryptCredentials(envelopeBase64: string, keyBase64: string): string {
  const key = loadKey(keyBase64);
  const buf = Buffer.from(envelopeBase64, 'base64');
  if (buf.length < IV_BYTES + TAG_BYTES) {
    throw new Error('Envelope de credenciais inválido');
  }
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** Serializa e criptografa um objeto de token. */
export function sealToken(token: Record<string, unknown>, keyBase64: string): string {
  return encryptCredentials(JSON.stringify(token), keyBase64);
}

/** Descriptografa e desserializa um objeto de token. */
export function openToken<T = Record<string, unknown>>(
  envelope: string,
  keyBase64: string,
): T {
  return JSON.parse(decryptCredentials(envelope, keyBase64)) as T;
}
