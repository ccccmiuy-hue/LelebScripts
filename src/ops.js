const SUPPORTED = new Set(['match-pair', 'fill-gap', 'categorize', 'sequence', 'choose']);

export class OperationValidationError extends Error {
  constructor(message, operation = null) {
    super(message);
    this.name = 'OperationValidationError';
    this.operation = operation;
  }
}

function requiredString(operation, field) {
  if (typeof operation?.[field] !== 'string' || operation[field].trim() === '') {
    throw new OperationValidationError(`A operação ${operation?.op || '?'} exige o campo ${field}.`, operation);
  }
  return operation[field];
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function validateOperations(operations) {
  if (!Array.isArray(operations)) {
    throw new TypeError('operations deve ser um array.');
  }
  return operations.map((operation) => {
    if (!operation || typeof operation !== 'object' || typeof operation.op !== 'string') {
      throw new OperationValidationError('Operação inválida: é necessário um objeto com campo op.', operation);
    }
    if (!SUPPORTED.has(operation.op)) {
      throw new OperationValidationError(`Operação não suportada: ${operation.op}.`, operation);
    }
    switch (operation.op) {
      case 'match-pair':
        return { op: operation.op, topId: requiredString(operation, 'topId'), bottomId: requiredString(operation, 'bottomId') };
      case 'fill-gap':
        return { op: operation.op, gapId: requiredString(operation, 'gapId'), answer: requiredString(operation, 'answer') };
      case 'categorize':
        return { op: operation.op, optionId: requiredString(operation, 'optionId'), targetId: requiredString(operation, 'targetId') };
      case 'sequence':
        if (!operation.positions || typeof operation.positions !== 'object' || Array.isArray(operation.positions)) {
          throw new OperationValidationError('A operação sequence exige positions como objeto.', operation);
        }
        return { op: operation.op, positions: clone(operation.positions) };
      case 'choose':
        if (!Array.isArray(operation.allIds) || !operation.allIds.length || !Array.isArray(operation.optionIds) || !operation.optionIds.length) {
          throw new OperationValidationError('A operação choose exige allIds e optionIds não vazios.', operation);
        }
        return {
          op: operation.op,
          allIds: operation.allIds.map(String),
          optionIds: operation.optionIds.map(String),
          multi: Boolean(operation.multi),
        };
      default:
        throw new OperationValidationError(`Operação não suportada: ${operation.op}.`, operation);
    }
  });
}

/**
 * Converte o protocolo observado do Mikael em ações declarativas.
 * Essas ações não são cliques; um adaptador autorizado da plataforma deve
 * convertê-las em requests HTTP de submissão.
 */
export function operationsToApiActions(operations) {
  return validateOperations(operations).map((operation) => {
    switch (operation.op) {
      case 'match-pair':
        return { kind: 'matching.answer', payload: { topId: operation.topId, bottomId: operation.bottomId } };
      case 'fill-gap':
        return { kind: 'gapfill.answer', payload: { gapId: operation.gapId, answer: operation.answer } };
      case 'categorize':
        return { kind: 'categorization.answer', payload: { optionId: operation.optionId, targetId: operation.targetId } };
      case 'sequence':
        return { kind: 'sequencing.answer', payload: { positions: operation.positions } };
      case 'choose':
        return { kind: 'multiple-choice.answer', payload: { allIds: operation.allIds, optionIds: operation.optionIds, multi: operation.multi } };
      default:
        throw new OperationValidationError(`Operação não suportada: ${operation.op}.`, operation);
    }
  });
}

function walk(value, visit, path = []) {
  if (!value || typeof value !== 'object') return;
  visit(value, path);
  if (Array.isArray(value)) {
    value.forEach((child, index) => walk(child, visit, [...path, index]));
    return;
  }
  for (const [key, child] of Object.entries(value)) walk(child, visit, [...path, key]);
}

function firstValue(object, keys) {
  for (const key of keys) {
    if (object && object[key] !== undefined && object[key] !== null) return object[key];
  }
  return undefined;
}

export function extractAnswerHints(payload) {
  const matching = {};
  const gapfill = {};
  const sequencing = {};
  const multipleChoice = {};
  const activities = [];

  walk(payload, (node) => {
    const expected = node.expectedResponse;
    if (expected?.type === 'matching' && expected.contents?.matching && typeof expected.contents.matching === 'object') {
      for (const [id, entry] of Object.entries(expected.contents.matching)) {
        const answer = entry?.userInput;
        if (answer !== undefined && answer !== null) matching[id] = answer;
      }
    }
    if (expected?.type === 'gapfill' && expected.contents?.gapfill && typeof expected.contents.gapfill === 'object') {
      for (const [id, entry] of Object.entries(expected.contents.gapfill)) {
        const answer = firstValue(entry, ['userInput', 'answer', 'text']);
        if (answer !== undefined && answer !== null) gapfill[id] = answer;
      }
    }
    if (expected?.type === 'sequencing' && expected.contents?.sequencing && typeof expected.contents.sequencing === 'object') {
      const entries = Object.values(expected.contents.sequencing)
        .filter((entry) => entry && entry.id !== undefined)
        .sort((a, b) => Number(a.userInput ?? 0) - Number(b.userInput ?? 0));
      if (entries.length) sequencing[entries.map((entry) => String(entry.id)).join('|')] = entries.map((entry) => String(entry.id));
    }
    if (node.type === 'task-response-assessed') {
      const response = node.data?.taskResponseAssessed?.response;
      const taskId = node.data?.taskResponseAssessed?.taskId;
      const contents = response?.contents?.multipleChoice?.contents;
      if (taskId && contents && typeof contents === 'object') {
        multipleChoice[taskId] = Object.fromEntries(
          Object.entries(contents)
            .map(([id, entry]) => [id, entry?.assessment?.expectedUserInput])
            .filter(([, value]) => value === 'selected' || value === 'not-selected'),
        );
      }
    }
    const activity = node.data?.activitySent?.activity;
    if (node.type === 'activity-sent' && activity?.id) {
      activities.push({
        id: String(activity.id),
        stepId: node.data.activitySent.stepId ?? null,
        index: node.data.activitySent.index ?? 0,
        type: activity.tasks?.[0]?.expectedResponse?.type ?? 'unknown',
        taskCount: Array.isArray(activity.tasks) ? activity.tasks.length : 0,
      });
    }
  });

  return { matching, gapfill, sequencing, multipleChoice, activities };
}

export function summarizePayload(payload) {
  const hints = extractAnswerHints(payload);
  return {
    activityCount: hints.activities.length,
    answerHintCounts: {
      matching: Object.keys(hints.matching).length,
      gapfill: Object.keys(hints.gapfill).length,
      sequencing: Object.keys(hints.sequencing).length,
      multipleChoiceTasks: Object.keys(hints.multipleChoice).length,
    },
    activityTypes: [...new Set(hints.activities.map((activity) => activity.type))],
  };
}

export function buildOperationPlan(operations) {
  const normalized = validateOperations(operations);
  return {
    version: 1,
    apiOnly: true,
    actions: operationsToApiActions(normalized),
    counts: normalized.reduce((counts, operation) => {
      counts[operation.op] = (counts[operation.op] || 0) + 1;
      return counts;
    }, {}),
  };
}
