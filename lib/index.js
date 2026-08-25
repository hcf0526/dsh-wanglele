import { randomUUID } from "node:crypto";

const GPT_MODEL_PATTERN = /^gpt(?:-|$)/i;
const GEMINI_FLASH_MODEL_PATTERN = /^gemini-3(?:\.\d+)?-flash(?:-|$)/i;
const GPT_PATCHED_TOOL_NAMES = new Set([
  "pwsh",
  "edit",
  "write",
  "read",
  "grep",
  "glob",
  "subagent",
]);
const GPT_UNSAFE_TOOL_FIELDS = new Set([
  "sandbox_permissions",
  "justification",
]);
const GEMINI_TOOL_STREAM_ERROR =
  "Cannot read properties of undefined (reading 'startsWith')";

// DSH can invoke multiple pre-step listeners for the same session before the
// accepted message has been persisted. Keep only the prompt identity that was
// already proposed for each live session so that those callbacks cannot emit
// duplicate context rows. The durable surface check remains the source of truth
// after the event is persisted or after compaction.
const proposedCustomPrompts = new WeakMap();

export const name = "wanglele";
export const inject = ["systemPrompt", "agents"];

export const WANGLELE_SETTINGS_NS = "wanglele";
export const CUSTOM_PROMPT_SECTION_NAME = "wanglele:custom-system-prompt";

export const DEFAULT_SETTINGS = Object.freeze({
  customPromptEnabled: false,
  customPrompt: "",
  promptPosition: "append", // "append" | "prepend"
  textareaHeight: 280,
  gptCompatEnabled: true,
  geminiRecoverEnabled: true,
});

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze(value) {
  const seen = new WeakSet();
  const pending = [{ kind: "visit", node: value }];
  while (pending.length > 0) {
    const task = pending.pop();
    if (task === undefined) continue;
    if (task.kind === "property") {
      pending.push({ kind: "visit", node: task.source[task.key] });
      continue;
    }
    const node = task.node;
    if (node === null || typeof node !== "object") continue;
    if (node instanceof AbortSignal) continue;
    if (seen.has(node)) continue;
    seen.add(node);
    Object.freeze(node);
    const keys = Object.keys(node);
    for (let i = keys.length - 1; i >= 0; i--) {
      const key = keys[i];
      if (key !== undefined) {
        pending.push({ kind: "property", source: node, key });
      }
    }
  }
  return value;
}

export function createCustomPromptContextMessage(text, pluginName = name) {
  return deepFreeze({
    id: randomUUID(),
    role: "user",
    content: [
      {
        type: "text",
        text,
      },
    ],
    source: {
      kind: "plugin",
      plugin: pluginName,
    },
  });
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

function patchSchemaNode(node) {
  if (!isRecord(node)) return { value: node, changed: false };

  let changed = false;
  const result = { ...node };

  if (isRecord(node.properties)) {
    const properties = {};
    for (const [propertyName, definition] of Object.entries(node.properties)) {
      if (GPT_UNSAFE_TOOL_FIELDS.has(propertyName)) {
        changed = true;
        continue;
      }
      const patched = patchSchemaNode(definition);
      properties[propertyName] = patched.value;
      changed ||= patched.changed;
    }
    if (changed) result.properties = properties;
  }

  if (Array.isArray(node.required)) {
    const required = node.required.filter(
      (propertyName) => !GPT_UNSAFE_TOOL_FIELDS.has(propertyName),
    );
    if (required.length !== node.required.length) {
      result.required = required;
      changed = true;
    }
  }

  for (const key of ["items", "additionalProperties", "not", "if", "then", "else"]) {
    if (!isRecord(node[key])) continue;
    const patched = patchSchemaNode(node[key]);
    result[key] = patched.value;
    changed ||= patched.changed;
  }

  for (const key of ["allOf", "anyOf", "oneOf", "prefixItems"]) {
    if (!Array.isArray(node[key])) continue;
    result[key] = node[key].map((item) => {
      const patched = patchSchemaNode(item);
      changed ||= patched.changed;
      return patched.value;
    });
  }

  return { value: changed ? result : node, changed };
}

export function patchGptToolSchema(tool) {
  if (!isRecord(tool) || !GPT_PATCHED_TOOL_NAMES.has(tool.name)) return tool;
  if (!isRecord(tool.parameters)) return tool;

  const patched = patchSchemaNode(tool.parameters);
  if (!patched.changed) return tool;

  return {
    ...tool,
    parameters: patched.value,
  };
}


export function patchPwshSchema(tool) {
  return isRecord(tool) && tool.name === "pwsh" ? patchGptToolSchema(tool) : tool;
}

export function patchToolList(tools) {
  if (!Array.isArray(tools)) return tools;
  let changed = false;
  const patched = tools.map((tool) => {
    const nextTool = patchGptToolSchema(tool);
    if (nextTool !== tool) changed = true;
    return nextTool;
  });
  return changed ? patched : tools;
}

export function patchOutboundPayload(payload) {
  if (!isRecord(payload)) return payload;
  if (!Array.isArray(payload.tools)) return payload;

  const patchedTools = patchToolList(payload.tools);
  if (patchedTools === payload.tools) return payload;

  return {
    ...payload,
    tools: patchedTools,
  };
}

export function createOutboundPayloadHook(currentOnPayload, model) {
  return async (params, targetModel) => {
    const rawModel = targetModel ?? model;
    const resolvedModel = typeof rawModel === "string" ? rawModel : rawModel?.id;
    let nextParams = params;

    if (currentOnPayload) {
      const hookResult = await currentOnPayload(params, targetModel);
      if (hookResult !== undefined) nextParams = hookResult;
    }

    if (isCompatibilityModel(resolvedModel)) {
      nextParams = patchOutboundPayload(nextParams);
    }

    return nextParams;
  };
}

export function patchAssembly(assembly) {
  if (!isRecord(assembly) || !Array.isArray(assembly.tools)) return assembly;

  const tools = patchToolList(assembly.tools);
  return tools === assembly.tools ? assembly : { ...assembly, tools };
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

/**
 * Extract visible custom prompt state from the agent session surface.
 * Returns the latest active prompt text and event info visible in `agent.session.surface.nodes`.
 * If surface is undefined (e.g. mock/test environments), falls back to scanning events.
 */
export function getVisibleCustomPromptState(agent, pluginName = name) {
  const session = agent?.session;
  if (!session || !Array.isArray(session.events)) return undefined;

  const visibleSeqs = Array.isArray(session.surface?.nodes)
    ? new Set(session.surface.nodes)
    : undefined;

  // A plugin message is recorded in the event log only after the step is
  // accepted. During later turns, the session surface is authoritative. When
  // no surface is available in a lightweight host, use the event log fallback.
  const canCheckSurface = visibleSeqs !== undefined;
  for (let i = session.events.length - 1; i >= 0; i--) {
    const event = session.events[i];
    if (!event || event.type !== "user/message") continue;
    const source = event.data?.source;
    if (source?.kind !== "plugin" || source?.plugin !== pluginName) continue;

    const seq = typeof event.seq === "number" ? event.seq : i;
    if (canCheckSurface && !visibleSeqs.has(seq)) continue;
    const block = event.data?.content?.[0];
    const text =
      block?.type === "text" && typeof block?.text === "string"
        ? block.text
        : "";
    return {
      seq,
      text,
      message: event.data,
    };
  }

  return undefined;
}

/**
 * Apply custom prompt configuration as a context injection message.
 * Supports append, prepend, and replace modes.
 */
export function applyCustomPromptContext(messages, settings, pluginName = name) {
  if (!Array.isArray(messages)) return messages;
  if (!settings || !settings.customPromptEnabled) return messages;

  const customText =
    typeof settings.customPrompt === "string"
      ? settings.customPrompt.trim()
      : "";
  if (customText.length === 0) return messages;

  const contextMessage = createCustomPromptContextMessage(
    customText,
    pluginName,
  );
  const position = settings.promptPosition || "append";

  if (position === "replace") {
    return [contextMessage];
  } else if (position === "prepend") {
    return [contextMessage, ...messages];
  } else {
    // "append" (default)
    return [...messages, contextMessage];
  }
}

/**
 * Apply custom system prompt configuration onto assembled prompt sections (legacy helper).
 * Supports hot-reloaded prepend, append, and replace injection modes.
 */
export function applyCustomPrompt(assembly, settings) {
  if (!isRecord(assembly) || !Array.isArray(assembly.sections)) return assembly;
  if (!settings || !settings.customPromptEnabled) return assembly;

  const customText = typeof settings.customPrompt === "string"
    ? settings.customPrompt.trim()
    : "";
  if (customText.length === 0) return assembly;

  const customSection = {
    name: CUSTOM_PROMPT_SECTION_NAME,
    text: customText,
  };

  const position = settings.promptPosition || "append";
  const filteredSections = assembly.sections.filter(
    (s) => isRecord(s) && s.name !== CUSTOM_PROMPT_SECTION_NAME,
  );

  let newSections;
  if (position === "replace") {
    newSections = [customSection];
  } else if (position === "prepend") {
    newSections = [customSection, ...filteredSections];
  } else {
    // "append" (default)
    newSections = [...filteredSections, customSection];
  }

  return {
    ...assembly,
    sections: newSections,
  };
}

/**
 * Resolve settings with default fallbacks.
 */
export function resolveSettings(raw) {
  if (!isRecord(raw)) return { ...DEFAULT_SETTINGS };
  return {
    customPromptEnabled: typeof raw.customPromptEnabled === "boolean"
      ? raw.customPromptEnabled
      : DEFAULT_SETTINGS.customPromptEnabled,
    customPrompt: typeof raw.customPrompt === "string"
      ? raw.customPrompt
      : DEFAULT_SETTINGS.customPrompt,
    promptPosition: raw.promptPosition === "prepend" || raw.promptPosition === "replace" || raw.promptPosition === "append"
      ? raw.promptPosition
      : DEFAULT_SETTINGS.promptPosition,
    textareaHeight: typeof raw.textareaHeight === "number" && raw.textareaHeight > 0
      ? raw.textareaHeight
      : DEFAULT_SETTINGS.textareaHeight,
    gptCompatEnabled: typeof raw.gptCompatEnabled === "boolean"
      ? raw.gptCompatEnabled
      : DEFAULT_SETTINGS.gptCompatEnabled,
    geminiRecoverEnabled: typeof raw.geminiRecoverEnabled === "boolean"
      ? raw.geminiRecoverEnabled
      : DEFAULT_SETTINGS.geminiRecoverEnabled,
  };
}

export function apply(ctx, config = {}) {
  // Live in-memory settings, updated automatically and hot-reloaded
  let liveSettings = resolveSettings(config);

  // Install DSH settings provider registration if settings service is available
  if (typeof ctx.inject === "function") {
    ctx.inject(["settings"], (sctx) => {
      try {
        const schema = Object.assign(
          (input) => resolveSettings(input),
          {
            toJSON: () => ({
              type: "object",
              properties: {
                customPromptEnabled: { type: "boolean", default: DEFAULT_SETTINGS.customPromptEnabled },
                customPrompt: { type: "string", default: DEFAULT_SETTINGS.customPrompt },
                promptPosition: { type: "string", enum: ["append", "prepend", "replace"], default: DEFAULT_SETTINGS.promptPosition },
                textareaHeight: { type: "number", default: DEFAULT_SETTINGS.textareaHeight },
                gptCompatEnabled: { type: "boolean", default: DEFAULT_SETTINGS.gptCompatEnabled },
                geminiRecoverEnabled: { type: "boolean", default: DEFAULT_SETTINGS.geminiRecoverEnabled },
              },
            }),
          },
        );
        const scope = sctx.settings.register(WANGLELE_SETTINGS_NS, schema, {
          base: config,
        });
        liveSettings = resolveSettings(scope.get());
        scope.watch((next) => {
          liveSettings = resolveSettings(next);
        });
      } catch (err) {
        // Fall back to config if registration throws or duplicate
        ctx.logger?.warn?.(`[wanglele] settings registration note: ${err?.message || err}`);
      }
    });
  }

  // Agent Pre-Step hook: Injects custom prompt as a context injection message (shows as '上下文注入 · wanglele' in UI)
  // Follows official DSH surface.nodes lifecycle: injects on first turn, skips on subsequent turns,
  // and automatically re-injects when context compaction clears surface nodes or when prompt changes.
  ctx.on(
    "agent/pre-step",
    async ({ agent, turn, step, signal }, next) => {
      const decision = await next();
      if (decision.kind === "reject" || signal?.aborted) return decision;
      if (step !== 1) return decision;

      const currentSettings = liveSettings;
      if (!currentSettings.customPromptEnabled) return decision;

      const customText =
        typeof currentSettings.customPrompt === "string"
          ? currentSettings.customPrompt.trim()
          : "";
      if (customText.length === 0) return decision;

      // Skip if decision.messages already contains our plugin message
      const alreadyInDecision = decision.messages.some(
        (m) => m?.source?.kind === "plugin" && m?.source?.plugin === name,
      );
      if (alreadyInDecision) return decision;

      const session = agent?.session;
      const proposedText = session ? proposedCustomPrompts.get(session) : undefined;
      const surfaceState = getVisibleCustomPromptState(agent, name);
      const surfaceHasPluginMessage = surfaceState !== undefined;
      if (proposedText === customText && surfaceHasPluginMessage) return decision;

      if (proposedText === customText && !surfaceHasPluginMessage && turn !== 1 && !session?.surface) {
        return decision;
      }

      if (surfaceState !== undefined && surfaceState.text === customText) {
        if (session) proposedCustomPrompts.set(session, customText);
        return decision;
      }

      if (surfaceState === undefined && !session?.surface && turn !== 1) {
        return decision;
      }

      const newMessages = applyCustomPromptContext(
        decision.messages,
        currentSettings,
        name,
      );
      if (session) proposedCustomPrompts.set(session, customText);

      return {
        ...decision,
        messages: newMessages,
      };
    },
    { global: true },
  );

  // System Prompt Assembly hook (patches GPT & Gemini tool schemas)
  ctx.on(
    "system-prompt/assemble",
    async (assembly, context, next) => {
      let assembled = await next();
      const currentSettings = liveSettings;

      // Patch GPT & Gemini tool schemas if compat enabled
      if (currentSettings.gptCompatEnabled !== false) {
        const model = modelForAssembly(assembled, context);
        if (isCompatibilityModel(model)) {
          assembled = patchAssembly(assembled);
        }
      }

      return assembled;
    },
    { global: true },
  );

  // LLM Stream hook: wraps onPayload to enforce outbound tool schema stripping
  // and recovers Gemini tool-call stream if enabled
  ctx.on(
    "llm/stream",
    (options, next) => {
      const currentSettings = liveSettings;
      const model = isRecord(options) ? options.model : undefined;
      const effectiveOptions = isRecord(options) ? { ...options } : options;

      if (currentSettings.gptCompatEnabled !== false && isRecord(effectiveOptions)) {
        effectiveOptions.onPayload = createOutboundPayloadHook(
          effectiveOptions.onPayload,
          model,
        );
      }

      const stream = next(effectiveOptions);
      if (currentSettings.geminiRecoverEnabled === false || !isGeminiFlashModel(model)) {
        return stream;
      }
      return recoverGeminiToolCallStream(model, stream);
    },
    { global: true },
  );
}

