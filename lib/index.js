const GPT_MODEL_PATTERN = /^gpt(?:-|$)/i;
const GPT_UNSAFE_PWSH_FIELDS = new Set([
  "sandbox_permissions",
  "justification",
]);

export const name = "gpt-pwsh-compat";
export const inject = ["systemPrompt"];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isGptModel(model) {
  return typeof model === "string" && GPT_MODEL_PATTERN.test(model);
}

function patchProperties(properties) {
  let changed = false;
  const patched = {};

  for (const [propertyName, definition] of Object.entries(properties)) {
    if (GPT_UNSAFE_PWSH_FIELDS.has(propertyName)) {
      changed = true;
      continue;
    }
    patched[propertyName] = definition;
  }

  return changed ? patched : properties;
}

function patchRequired(required) {
  if (!Array.isArray(required)) return required;
  const patched = required.filter(
    (propertyName) => !GPT_UNSAFE_PWSH_FIELDS.has(propertyName),
  );
  return patched.length === required.length ? required : patched;
}

export function patchPwshSchema(tool) {
  if (!isRecord(tool) || tool.name !== "pwsh") return tool;
  if (!isRecord(tool.parameters)) return tool;
  if (!isRecord(tool.parameters.properties)) return tool;

  const properties = patchProperties(tool.parameters.properties);
  const required = patchRequired(tool.parameters.required);

  if (
    properties === tool.parameters.properties &&
    required === tool.parameters.required
  ) {
    return tool;
  }

  return {
    ...tool,
    parameters: {
      ...tool.parameters,
      properties,
      ...(required === undefined ? {} : { required }),
    },
  };
}

export function patchAssembly(assembly) {
  if (!isRecord(assembly) || !Array.isArray(assembly.tools)) return assembly;

  let changed = false;
  const tools = assembly.tools.map((tool) => {
    const patched = patchPwshSchema(tool);
    if (patched !== tool) changed = true;
    return patched;
  });

  return changed ? { ...assembly, tools } : assembly;
}

function modelForAssembly(assembly, context) {
  const assembledModel = isRecord(assembly.variables)
    ? assembly.variables.model
    : undefined;
  if (typeof assembledModel === "string") return assembledModel;

  const agent = isRecord(context) ? context.agent : undefined;
  const options = isRecord(agent) ? agent.options : undefined;
  return isRecord(options) ? options.model : undefined;
}

export function apply(ctx) {
  ctx.on(
    "system-prompt/assemble",
    async (_assembly, context, next) => {
      const assembled = await next();
      const model = modelForAssembly(assembled, context);
      return isGptModel(model) ? patchAssembly(assembled) : assembled;
    },
    { global: true },
  );
}
