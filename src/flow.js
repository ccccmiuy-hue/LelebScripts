import { buildOperationPlan, summarizePayload } from './ops.js';

export async function solvePayloadWithMikael(mikael, payload) {
  const { license, ops } = await mikael.solvePayload(payload);
  return {
    license,
    payloadSummary: summarizePayload(payload),
    operations: ops,
    plan: buildOperationPlan(ops),
  };
}

export async function executeApiOnlyFlow({
  mikael,
  efekta,
  lessonRequest,
  actionRequests = {},
  context = {},
  send = false,
} = {}) {
  if (!mikael || !efekta) throw new TypeError('mikael e efekta são obrigatórios.');
  const lesson = await efekta.readLessonCommand(lessonRequest, context);
  const solved = await solvePayloadWithMikael(mikael, lesson.body);
  const results = await efekta.executePlan(
    solved.plan,
    actionRequests,
    { ...context, lessonResponse: lesson.body, plan: solved.plan },
    { dryRun: !send },
  );
  return {
    mode: send ? 'send' : 'dry-run',
    lesson: { url: lesson.url, status: lesson.status, body: lesson.body },
    ...solved,
    results,
  };
}
