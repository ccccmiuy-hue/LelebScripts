const DEFAULT_BASE_URL = 'https://mikael.store';
const DEFAULT_BUILD = 'bmspgs5gz';
const DEFAULT_COMPONENT = 'mkc-cf13efce2cff79dd';

export class MikaelApiError extends Error {
  constructor(message, { status = 0, body = null, url = '' } = {}) {
    super(message);
    this.name = 'MikaelApiError';
    this.status = status;
    this.body = body;
    this.url = url;
  }
}

export function createDeviceId(prefix = 'api') {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

function ensureFetch(fetchImpl) {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('É necessário fornecer uma implementação de fetch.');
  }
  return fetchImpl;
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function withTimeoutSignal(signal, timeoutMs) {
  if (typeof AbortController === 'undefined' || !timeoutMs) {
    return { signal, cleanup: () => {} };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Timeout')), timeoutMs);
  const forwardAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) forwardAbort();
    else signal.addEventListener('abort', forwardAbort, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', forwardAbort);
    },
  };
}

export class MikaelClient {
  constructor({
    licenseKey,
    deviceId,
    build = DEFAULT_BUILD,
    component = DEFAULT_COMPONENT,
    baseUrl = DEFAULT_BASE_URL,
    fetchImpl = globalThis.fetch,
    timeoutMs = 10000,
  } = {}) {
    this.licenseKey = String(licenseKey || '').trim();
    this.deviceId = String(deviceId || '').trim();
    this.build = String(build || DEFAULT_BUILD);
    this.component = String(component || DEFAULT_COMPONENT);
    this.baseUrl = String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.fetchImpl = ensureFetch(fetchImpl);
    this.timeoutMs = timeoutMs;
  }

  assertCredentials() {
    if (!this.licenseKey) throw new MikaelApiError('MIKAEL_LICENSE_KEY não configurada.');
    if (!this.deviceId) throw new MikaelApiError('MIKAEL_DEVICE_ID não configurado.');
  }

  async request(path, init = {}, { signal } = {}) {
    const url = `${this.baseUrl}${path}`;
    const timed = withTimeoutSignal(signal, this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, { ...init, signal: timed.signal });
      const body = await readJson(response);
      return { response, body, url };
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new MikaelApiError('A chamada ao Mikael expirou ou foi cancelada.', { url });
      }
      throw new MikaelApiError(`Falha de rede ao chamar o Mikael: ${error.message}`, { url });
    } finally {
      timed.cleanup();
    }
  }

  licenseUrl() {
    this.assertCredentials();
    const query = new URLSearchParams({
      k: this.licenseKey,
      d: this.deviceId,
      bv: this.build,
      c: this.component,
    });
    return `${this.baseUrl}/api/license/check?${query}`;
  }

  async checkLicense({ signal } = {}) {
    const url = this.licenseUrl();
    const { response, body } = await this.request(`/api/license/check?${new URL(url).searchParams}`, { method: 'GET' }, { signal });
    if (!response.ok || body?.ok !== true) {
      throw new MikaelApiError('O Mikael recusou a licença.', { status: response.status, body, url });
    }
    return body;
  }

  async getOperations(payload, { signal } = {}) {
    this.assertCredentials();
    if (!payload || typeof payload !== 'object') {
      throw new TypeError('payload deve ser um objeto JSON.');
    }
    const body = {
      k: this.licenseKey,
      d: this.deviceId,
      payload,
    };
    const { response, body: result, url } = await this.request('/api/agent/ops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    }, { signal });
    if (!response.ok || result?.ok !== true || !Array.isArray(result?.ops)) {
      throw new MikaelApiError('O Mikael não devolveu uma lista válida de operações.', {
        status: response.status,
        body: result,
        url,
      });
    }
    return result.ops;
  }

  async solvePayload(payload, options = {}) {
    const license = await this.checkLicense(options);
    const ops = await this.getOperations(payload, options);
    return { license, ops };
  }
}
