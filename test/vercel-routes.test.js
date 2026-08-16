import test from 'node:test';
import assert from 'node:assert/strict';
import health from '../api/health.js';
import normalize from '../api/normalize.js';
import solve from '../api/solve.js';

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name] = value; },
    end(value = '') { this.body += value; },
  };
}

function jsonBody(res) {
  return JSON.parse(res.body);
}

test('rota health responde sem consultar serviços externos', async () => {
  const res = responseRecorder();
  await health({ method: 'GET' }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(jsonBody(res).ok, true);
  assert.equal(jsonBody(res).service, 'mikael-api-only');
});

test('rota normalize valida operações', async () => {
  const res = responseRecorder();
  await normalize({ method: 'POST', body: { operations: [{ op: 'fill-gap', gapId: 'g1', answer: 'ok' }] } }, res);
  const body = jsonBody(res);
  assert.equal(res.statusCode, 200);
  assert.equal(body.plan.apiOnly, true);
  assert.equal(body.plan.actions[0].kind, 'gapfill.answer');
});

test('rota solve consulta licença e operações via fetch injetado', async () => {
  const originalFetch = globalThis.fetch;
  const originalLicense = process.env.MIKAEL_LICENSE_KEY;
  process.env.MIKAEL_LICENSE_KEY = 'test-license';
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (String(url).includes('/api/license/check')) return new Response(JSON.stringify({ ok: true }), { status: 200 });
    return new Response(JSON.stringify({ ok: true, ops: [{ op: 'choose', allIds: ['a', 'b'], optionIds: ['b'], multi: false }] }), { status: 200 });
  };
  try {
    const res = responseRecorder();
    await solve({ method: 'POST', body: { payload: { eventHistory: { events: [] } } } }, res);
    const body = jsonBody(res);
    assert.equal(res.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.operations[0].op, 'choose');
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalLicense === undefined) delete process.env.MIKAEL_LICENSE_KEY;
    else process.env.MIKAEL_LICENSE_KEY = originalLicense;
  }
});
