const MAX_BODY_BYTES = 1024 * 1024;

export function applyCors(req, res) {
  const origin = process.env.CORS_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function endOptions(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

export function sendJson(req, res, status, body) {
  applyCors(req, res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += Buffer.byteLength(chunk);
    if (total > MAX_BODY_BYTES) throw Object.assign(new Error('Corpo da requisição excede 1 MB.'), { statusCode: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('Corpo deve ser JSON válido.'), { statusCode: 400 });
  }
}

export function requireMethod(req, res, methods) {
  if (methods.includes(req.method)) return false;
  res.setHeader('Allow', methods.join(', '));
  sendJson(req, res, 405, { ok: false, error: 'Método não permitido.' });
  return true;
}

export function handleError(req, res, error) {
  const status = Number(error?.statusCode || error?.status || 500);
  const safeStatus = status >= 400 && status <= 599 ? status : 500;
  sendJson(req, res, safeStatus, {
    ok: false,
    error: error?.message || 'Erro interno.',
    ...(process.env.NODE_ENV === 'development' ? { details: error?.stack } : {}),
  });
}
