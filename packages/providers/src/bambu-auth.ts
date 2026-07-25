/**
 * Autenticação REAL da Bambu Cloud (login + verificação por código de
 * e-mail) — atrás da flag BAMBU_LIVE_ENABLED. Assim como bambu-cloud.ts,
 * isto é engenharia reversa baseada em documentação comunitária (não há API
 * pública oficial da Bambu Lab) e DEVE ser validado com credenciais reais
 * antes de habilitar em produção. Endpoints e formato de resposta são
 * HIPÓTESES — a Bambu pode alterá-los ou bloquear acesso de terceiros a
 * qualquer momento sem aviso.
 *
 * Fluxo:
 * 1) login(account, password) — se a conta não exigir verificação, já volta
 *    com accessToken. Se exigir, a Bambu envia um código por e-mail e a
 *    resposta indica loginType = "verifyCode".
 * 2) verifyLoginCode(account, code) — troca o código pelo accessToken.
 */

import { ProviderError } from './types.js';
import type { BambuRegion } from './bambu-cloud.js';

const REGION_HOSTS: Record<BambuRegion, string> = {
  global: 'https://api.bambulab.com',
  china: 'https://api.bambulab.cn',
};

export interface BambuAuthResult {
  /** true quando a Bambu exige um código enviado por e-mail antes de liberar o token. */
  needsVerification: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface BambuAuthDeps {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

async function postJson(
  host: string,
  path: string,
  body: Record<string, unknown>,
  deps?: BambuAuthDeps,
): Promise<Record<string, unknown>> {
  const fetchImpl = deps?.fetchImpl ?? fetch;
  const timeoutMs = deps?.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(new URL(path, host).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text().catch(() => '');
    let parsed: Record<string, unknown> = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      // resposta não-JSON — trata como corpo bruto abaixo
    }
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new ProviderError('Credenciais inválidas.', 'unauthorized', false);
      }
      if (res.status === 429) {
        throw new ProviderError('Muitas tentativas — aguarde e tente novamente.', 'rate_limited', true);
      }
      throw new ProviderError(
        `Falha ao autenticar (HTTP ${res.status}): ${text.slice(0, 200)}`,
        'unknown',
        res.status >= 500,
      );
    }
    return parsed;
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if ((err as { name?: string }).name === 'AbortError') {
      throw new ProviderError('Tempo esgotado ao contatar a Bambu Cloud.', 'timeout', true);
    }
    throw new ProviderError(
      'Não foi possível contatar a Bambu Cloud. A API não é oficial e pode estar indisponível.',
      'network',
      true,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Passo 1: login com email + senha. Pode retornar token direto ou pedir verificação. */
export async function login(
  account: string,
  password: string,
  region: BambuRegion,
  deps?: BambuAuthDeps,
): Promise<BambuAuthResult> {
  const host = REGION_HOSTS[region];
  // HIPÓTESE (validar): POST /v1/user-service/user/login { account, password }
  const data = await postJson(host, '/v1/user-service/user/login', { account, password }, deps);

  const loginType = data.loginType as string | undefined;
  if (loginType === 'verifyCode' || loginType === 'tfa') {
    return { needsVerification: true };
  }

  const accessToken = data.accessToken as string | undefined;
  if (!accessToken) {
    throw new ProviderError(
      'Resposta inesperada da Bambu Cloud ao autenticar (formato pode ter mudado).',
      'unknown',
      false,
    );
  }
  return {
    needsVerification: false,
    accessToken,
    refreshToken: data.refreshToken as string | undefined,
    expiresIn: data.expiresIn as number | undefined,
  };
}

/** Passo 2: troca o código recebido por e-mail pelo accessToken. */
export async function verifyLoginCode(
  account: string,
  code: string,
  region: BambuRegion,
  deps?: BambuAuthDeps,
): Promise<BambuAuthResult> {
  const host = REGION_HOSTS[region];
  // HIPÓTESE (validar): POST /v1/user-service/user/login { account, code }
  const data = await postJson(host, '/v1/user-service/user/login', { account, code }, deps);

  const accessToken = data.accessToken as string | undefined;
  if (!accessToken) {
    throw new ProviderError('Código inválido ou expirado.', 'unauthorized', false);
  }
  return {
    needsVerification: false,
    accessToken,
    refreshToken: data.refreshToken as string | undefined,
    expiresIn: data.expiresIn as number | undefined,
  };
}
