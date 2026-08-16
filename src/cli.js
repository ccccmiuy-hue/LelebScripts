#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { MikaelClient } from './mikael-client.js';
import { buildOperationPlan, summarizePayload, validateOperations } from './ops.js';
import { EfektaHttpClient, loadActionRequests } from './efekta-http.js';

function usage() {
  console.log(`Uso:
  node src/cli.js license --config config.json
  node src/cli.js ops --payload payload.json --config config.json
  node src/cli.js normalize --ops operations.json
  node src/cli.js plan --payload payload.json --config config.json
  node src/cli.js efekta --config config.json [--send]

Comandos:
  license    valida a licença no serviço Mikael.
  ops        envia um payload JSON ao Mikael e imprime as operações.
  normalize  valida operações e gera ações semânticas API-only.
  plan       valida a licença, consulta operações e imprime o plano.
  efekta     lê uma resposta da Efekta, consulta o Mikael e prepara requests HTTP.

O comando efekta usa dry-run por padrão. Use --send somente depois de revisar a configuração dos endpoints.
`);
}

function flag(args, name, fallback = undefined) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

function hasFlag(args, name) {
  return args.includes(name);
}

async function jsonFile(path) {
  if (!path) throw new Error('Informe o caminho do arquivo JSON.');
  return JSON.parse(await readFile(path, 'utf8'));
}

async function configFile(path) {
  if (!path) return {};
  return jsonFile(path);
}

function mikaelFrom(config) {
  const mikael = config.mikael || {};
  return new MikaelClient({
    licenseKey: process.env.MIKAEL_LICENSE_KEY || mikael.licenseKey,
    deviceId: process.env.MIKAEL_DEVICE_ID || mikael.deviceId,
    build: process.env.MIKAEL_BUILD || mikael.build,
    component: process.env.MIKAEL_COMPONENT || mikael.component,
    baseUrl: process.env.MIKAEL_BASE_URL || mikael.baseUrl,
    timeoutMs: Number(process.env.MIKAEL_TIMEOUT_MS || mikael.timeoutMs || 10000),
  });
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') {
    usage();
    return;
  }

  if (command === 'normalize') {
    const value = await jsonFile(flag(args, '--ops'));
    const operations = Array.isArray(value) ? value : value.ops;
    output(buildOperationPlan(validateOperations(operations)));
    return;
  }

  const config = await configFile(flag(args, '--config'));
  const mikael = mikaelFrom(config);

  if (command === 'license') {
    output(await mikael.checkLicense());
    return;
  }

  if (command === 'ops' || command === 'plan') {
    const payload = await jsonFile(flag(args, '--payload'));
    const result = await mikael.solvePayload(payload);
    if (command === 'ops') {
      output({ ops: result.ops });
    } else {
      output({ payloadSummary: summarizePayload(payload), plan: buildOperationPlan(result.ops) });
    }
    return;
  }

  if (command === 'efekta') {
    const lessonRequest = config.efekta?.lessonRequest;
    if (!lessonRequest) throw new Error('config.efekta.lessonRequest não configurado.');
    const efekta = new EfektaHttpClient(config.efekta);
    const lessonResponse = await efekta.readLessonCommand(lessonRequest, config.context || {});
    const solved = await mikael.solvePayload(lessonResponse.body);
    const plan = buildOperationPlan(solved.ops);
    const send = hasFlag(args, '--send');
    const results = await efekta.executePlan(
      plan,
      loadActionRequests(config),
      { ...(config.context || {}), lessonResponse: lessonResponse.body, plan },
      { dryRun: !send },
    );
    output({
      mode: send ? 'send' : 'dry-run',
      lessonRequest: { url: lessonResponse.url, status: lessonResponse.status },
      payloadSummary: summarizePayload(lessonResponse.body),
      plan,
      results,
    });
    return;
  }

  throw new Error(`Comando desconhecido: ${command}`);
}

main().catch((error) => {
  console.error(`[erro] ${error.message}`);
  if (process.env.DEBUG) console.error(error.stack);
  process.exitCode = 1;
});
