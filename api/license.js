import { endOptions, handleError, requireMethod, sendJson } from './_lib/http.js';
import { getMikaelClient } from './_lib/mikael.js';

export default async function handler(req, res) {
  try {
    if (endOptions(req, res)) return;
    if (requireMethod(req, res, ['GET', 'POST'])) return;
    const result = await getMikaelClient().checkLicense();
    sendJson(req, res, 200, {
      ok: true,
      license: result,
    });
  } catch (error) {
    handleError(req, res, error);
  }
}
