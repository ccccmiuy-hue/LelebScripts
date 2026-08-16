import { endOptions, handleError, readJson, requireMethod, sendJson } from './_lib/http.js';
import { buildOperationPlan } from '../src/ops.js';

export default async function handler(req, res) {
  try {
    if (endOptions(req, res)) return;
    if (requireMethod(req, res, ['POST'])) return;
    const body = await readJson(req);
    const operations = Array.isArray(body) ? body : body?.operations ?? body?.ops;
    sendJson(req, res, 200, {
      ok: true,
      plan: buildOperationPlan(operations),
    });
  } catch (error) {
    handleError(req, res, error);
  }
}
