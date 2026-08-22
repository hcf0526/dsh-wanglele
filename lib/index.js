const GPT_MODEL_PATTERN = /^gpt(?:-|$)/i;
const GEMINI_FLASH_MODEL_PATTERN = /^gemini-3(?:\.\d+)?-flash(?:-|$)/i;
const GPT_PATCHED_TOOL_NAMES = new Set(["pwsh", "edit"]);
const GPT_UNSAFE_TOOL_FIELDS = new Set([
  "sandbox_permissions",
  "justification",
]);
const GEMINI_TOOL_STREAM_ERROR =
  "Cannot read properties of undefined (reading 'startsWith')";

export const name = "gpt-pwsh-compat";
export const inject = ["systemPrompt", "agents"];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isGptModel(model) {
  return typeof model === "string" && GPT_MODEL_PATTERN.test(model);
}

export function isGeminiFlashModel(model) {
  return typeof model === "string" && GEMINI_FLASH_MODEL_PATTERN.test(model);
}

function isCompatibilityModel(model) {
  return isGptModel(model) || isGeminiFlashModel(model);
}

function patchProperties(properties) {
  let changed = false;
  const patched = {};

  for (const [propertyName, definition] of Object.entries(properties)) {
    if (GPT_UNSAFE_TOOL_FIELDS.has(propertyName)) {
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
    (propertyName) => !GPT_UNSAFE_TOOL_FIELDS.has(propertyName),
  );
  return patched.length === required.length ? required : patched;
}

export function patchGptToolSchema(tool) {
  if (!isRecord(tool) || !GPT_PATCHED_TOOL_NAMES.has(tool.name)) return tool;
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

export function patchPwshSchema(tool) {
  return isRecord(tool) && tool.name === "pwsh" ? patchGptToolSchema(tool) : tool;
}

export function patchAssembly(assembly) {
  if (!isRecord(assembly) || !Array.isArray(assembly.tools)) return assembly;

  let changed = false;
  const tools = assembly.tools.map((tool) => {
    const patched = patchGptToolSchema(tool);
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

function errorMessage(error) {
  return error instanceof Error ? error.message : undefined;
}

export function isGeminiToolStreamFailure(reason) {
  if (!isRecord(reason) || reason.kind !== "error") return false;
  const failure = reason.failure;
  return (
    isRecord(failure) &&
    typeof failure.message === "string" &&
    failure.message.includes(GEMINI_TOOL_STREAM_ERROR)
  );
}

function recoverableBlock(block) {
  if (!isRecord(block)) return false;
  if (block.kind === "text" || block.kind === "reasoning") return true;
  return (
    block.kind === "tool-call" &&
    typeof block.name === "string" &&
    block.name.length > 0
  );
}

function recoveredBlockEnd(block) {
  if (block.kind === "tool-call") {
    return {
      type: "block-end",
      index: block.index,
      block: {
        type: "tool-call",
        id:
          typeof block.id === "string" && block.id.length > 0
            ? block.id
            : `gemini-recovered-${block.index}`,
        name: block.name,
        arguments: block.arguments.length > 0 ? block.arguments : "{}",
      },
    };
  }

  return {
    type: "block-end",
    index: block.index,
    block: {
      type: block.kind,
      text: block.text,
    },
  };
}

function canRecoverBlocks(openBlocks) {
  return openBlocks.size > 0 && [...openBlocks.values()].every(recoverableBlock);
}

async function* recoverOpenBlocks(openBlocks) {
  for (const block of openBlocks.values()) {
    yield recoveredBlockEnd(block);
  }
  yield {
    type: "finish",
    reason: { kind: "tool-calls" },
  };
}

export async function* recoverGeminiToolCallStream(model, source) {
  if (!isGeminiFlashModel(model)) {
    yield* source;
    return;
  }

  const openBlocks = new Map();

  try {
    for await (const chunk of source) {
      if (chunk?.type === "block-start") {
        openBlocks.set(chunk.index, {
          index: chunk.index,
          kind: chunk.blockType,
          id: undefined,
          name: undefined,
          arguments: "",
          text: "",
        });
      } else if (chunk?.type === "tool-call-delta") {
        const block =
          openBlocks.get(chunk.index) ??
          {
            index: chunk.index,
            kind: "tool-call",
            id: undefined,
            name: undefined,
            arguments: "",
            text: "",
          };
        if (typeof chunk.id === "string" && chunk.id.length > 0) {
          block.id = chunk.id;
        }
        if (typeof chunk.name === "string" && chunk.name.length > 0) {
          block.name = chunk.name;
        }
        if (typeof chunk.argumentsDelta === "string") {
          block.arguments += chunk.argumentsDelta;
        }
        openBlocks.set(chunk.index, block);
      } else if (
        (chunk?.type === "text-delta" || chunk?.type === "reasoning-delta") &&
        typeof chunk.text === "string"
      ) {
        const block = openBlocks.get(chunk.index);
        if (block !== undefined) block.text += chunk.text;
      } else if (chunk?.type === "block-end") {
        openBlocks.delete(chunk.index);
      }

      if (
        chunk?.type === "finish" &&
        isGeminiToolStreamFailure(chunk.reason) &&
        canRecoverBlocks(openBlocks)
      ) {
        yield* recoverOpenBlocks(openBlocks);
        return;
      }

      yield chunk;
      if (chunk?.type === "finish") return;
    }
  } catch (error) {
    if (
      errorMessage(error)?.includes(GEMINI_TOOL_STREAM_ERROR) &&
      canRecoverBlocks(openBlocks)
    ) {
      yield* recoverOpenBlocks(openBlocks);
      return;
    }
    throw error;
  }
}

export function apply(ctx, _config = {}) {
  ctx.on(
    "system-prompt/assemble",
    async (_assembly, context, next) => {
      const assembled = await next();
      const model = modelForAssembly(assembled, context);
      return isCompatibilityModel(model) ? patchAssembly(assembled) : assembled;
    },
    { global: true },
  );

  ctx.on(
    "llm/stream",
    (options, next) => {
      const model = isRecord(options) ? options.model : undefined;
      if (!isGeminiFlashModel(model)) return next();
      return recoverGeminiToolCallStream(model, next());
    },
    { global: true },
  );
}
