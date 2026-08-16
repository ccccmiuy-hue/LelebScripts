import { endOptions, handleError, requireMethod, sendJson } from './_lib/http.js';

export default async function handler(req, res) {
  try {
    if (endOptions(req, res)) return;
    if (requireMethod(req, res, ['GET'])) return;
    sendJson(req, res, 200, {
      ok: true,
      service: 'mikael-api-only',
      runtime: 'vercel-nodejs',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleError(req, res, error);
  }
}
