import { endOptions, handleError, readJson, requireMethod, sendJson } from './_lib/http.js';
import { getMikaelClient } from './_lib/mikael.js';
import { buildOperationPlan, summarizePayload } from '../src/ops.js';

export default async function handler(req, res) {
  try {
    if (endOptions(req, res)) return;
    if (requireMethod(req, res, ['POST'])) return;
    const body = await readJson(req);
    const payload = body?.payload ?? body;
    const solved = await getMikaelClient().solvePayload(payload);
    sendJson(req, res, 200, {
      ok: true,
      payloadSummary: summarizePayload(payload),
      operations: solved.ops,
      plan: buildOperationPlan(solved.ops),
    });
  } catch (error) {
    handleError(req, res, error);
  }
}
