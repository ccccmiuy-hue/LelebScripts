export class EfektaHttpError extends Error {
  constructor(message, { status = 0, body = null, url = '' } = {}) {
    super(message);
    this.name = 'EfektaHttpError';
    this.status = status;
    this.body = body;
    this.url = url;
  }
}

function replaceTemplate(value, context) {
  if (typeof value === 'string') {
    const exact = value.match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
    if (exact) return exact[1].split('.').reduce((current, key) => current?.[key], context);
    return value.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, path) => {
      const result = path.trim().split('.').reduce((current, key) => current?.[key], context);
      return result === undefined || result === null ? '' : String(result);
    });
  }
  if (Array.isArray(value)) return value.map((item) => replaceTemplate(item, context));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceTemplate(item, context)]));
  }
  return value;
}

async function parseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

export class EfektaHttpClient {
  constructor({ baseUrl = '', headers = {}, fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
    if (typeof fetchImpl !== 'function') throw new TypeError('É necessário fornecer uma implementação de fetch.');
    this.baseUrl = String(baseUrl || '').replace(/\/+$/, '');
    this.headers = { Accept: 'application/json', ...headers };
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  resolveUrl({ url, path, query } = {}) {
    const target = url || (path ? `${this.baseUrl}${path}` : '');
    if (!target) throw new TypeError('O request da Efekta exige url ou path.');
    const resolved = new URL(target, this.baseUrl || undefined);
    if (query && typeof query === 'object') {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) resolved.searchParams.set(key, String(value));
      }
    }
    return resolved.toString();
  }

  async request(spec, context = {}) {
    const resolved = replaceTemplate(spec, context);
    const url = this.resolveUrl(resolved);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers = { ...this.headers, ...(resolved.headers || {}) };
    const init = { method: resolved.method || 'GET', headers, signal: controller.signal };
    if (resolved.body !== undefined && resolved.body !== null) {
      init.body = typeof resolved.body === 'string' ? resolved.body : JSON.stringify(resolved.body);
      if (!Object.keys(headers).some((name) => name.toLowerCase() === 'content-type')) {
        headers['Content-Type'] = 'application/json';
      }
    }
    try {
      const response = await this.fetchImpl(url, init);
      const body = await parseBody(response);
      if (!response.ok) throw new EfektaHttpError(`A API da Efekta respondeu ${response.status}.`, { status: response.status, body, url });
      return { status: response.status, headers: response.headers, body, url };
    } catch (error) {
      if (error instanceof EfektaHttpError) throw error;
      if (error?.name === 'AbortError') throw new EfektaHttpError('A chamada à Efekta expirou.', { url });
      throw new EfektaHttpError(`Falha de rede ao chamar a Efekta: ${error.message}`, { url });
    } finally {
      clearTimeout(timer);
    }
  }

  async readLessonCommand(spec, context = {}) {
    return this.request(spec, context);
  }

  async executePlan(plan, actionRequests = {}, context = {}, { dryRun = false } = {}) {
    const results = [];
    for (const action of plan.actions || []) {
      const spec = actionRequests[action.kind];
      if (!spec) {
        results.push({ action, status: 'unmapped', reason: 'Nenhum endpoint HTTP configurado para esta ação.' });
        continue;
      }
      const requestContext = { ...context, action, payload: action.payload };
      if (dryRun) {
        results.push({ action, status: 'dry-run', request: replaceTemplate(spec, requestContext) });
      } else {
        const response = await this.request(spec, requestContext);
        results.push({ action, status: 'sent', response });
      }
    }
    return results;
  }
}

export function loadActionRequests(config = {}) {
  return config.actionRequests || {};
}
