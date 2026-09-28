import { randomUUID } from "node:crypto";
import z from "@deepseek-ai/schemastery";

export const AUTO_RETRY_CONTINUE_TEXT = "继续";

export const name = "wanglele";
export const inject = ["agents", "systemPrompt"];
export const WANGLELE_SETTINGS_NS = "wanglele";
export const AUTO_RETRY_MIN_DELAY_SECONDS = 1;
export const AUTO_RETRY_MAX_DELAY_SECONDS = 600;
export const AUTO_RETRY_MIN_FAILURES = 1;
export const AUTO_RETRY_MAX_FAILURES = 100;

export const DEFAULT_SETTINGS = Object.freeze({
  autoRetryEnabled: false,
  autoRetryDelaySeconds: 5,
  autoRetryMaxFailures: 3,
  customPromptEnabled: false,
  customPrompt: "",
  promptPosition: "append",
});

export const CUSTOM_PROMPT_SECTION_NAME = "wanglele:custom-system-prompt";

export const Config = z.object({
  autoRetryEnabled: z.boolean().default(DEFAULT_SETTINGS.autoRetryEnabled).volatile(),
  autoRetryDelaySeconds: z.number().default(DEFAULT_SETTINGS.autoRetryDelaySeconds).volatile(),
  autoRetryMaxFailures: z.number().default(DEFAULT_SETTINGS.autoRetryMaxFailures).volatile(),
  customPromptEnabled: z.boolean().default(DEFAULT_SETTINGS.customPromptEnabled).volatile(),
  customPrompt: z.string().default(DEFAULT_SETTINGS.customPrompt).volatile(),
  promptPosition: z.string().default(DEFAULT_SETTINGS.promptPosition).volatile(),
});

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze(value) {
  const seen = new WeakSet();
  const pending = [value];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === null || typeof node !== "object" || node instanceof AbortSignal || seen.has(node)) continue;
    seen.add(node);
    Object.freeze(node);
    for (const child of Object.values(node)) pending.push(child);
  }
  return value;
}

function readConfigValue(value) {
  return isRecord(value) && typeof value.get === "function" ? value.get() : value;
}

function clampInteger(value, fallback, min, max) {
  const resolved = readConfigValue(value);
  if (typeof resolved !== "number" || !Number.isFinite(resolved)) return fallback;
  return Math.min(max, Math.max(min, Math.round(resolved)));
}

export function resolveSettings(raw) {
  const enabled = isRecord(raw) ? readConfigValue(raw.autoRetryEnabled) : undefined;
  const customPromptEnabled = isRecord(raw) ? readConfigValue(raw.customPromptEnabled) : undefined;
  const customPrompt = isRecord(raw) ? readConfigValue(raw.customPrompt) : undefined;
  const promptPosition = isRecord(raw) ? readConfigValue(raw.promptPosition) : undefined;
  return {
    autoRetryEnabled: typeof enabled === "boolean"
      ? enabled
      : DEFAULT_SETTINGS.autoRetryEnabled,
    autoRetryDelaySeconds: clampInteger(
      isRecord(raw) ? raw.autoRetryDelaySeconds : undefined,
      DEFAULT_SETTINGS.autoRetryDelaySeconds,
      AUTO_RETRY_MIN_DELAY_SECONDS,
      AUTO_RETRY_MAX_DELAY_SECONDS,
    ),
    autoRetryMaxFailures: clampInteger(
      isRecord(raw) ? raw.autoRetryMaxFailures : undefined,
      DEFAULT_SETTINGS.autoRetryMaxFailures,
      AUTO_RETRY_MIN_FAILURES,
      AUTO_RETRY_MAX_FAILURES,
    ),
    customPromptEnabled: typeof customPromptEnabled === "boolean"
      ? customPromptEnabled
      : DEFAULT_SETTINGS.customPromptEnabled,
    customPrompt: typeof customPrompt === "string" ? customPrompt : DEFAULT_SETTINGS.customPrompt,
    promptPosition: ["append", "prepend", "replace"].includes(promptPosition)
      ? promptPosition
      : DEFAULT_SETTINGS.promptPosition,
  };
}

export function customPromptSectionText(raw) {
  const settings = resolveSettings(raw);
  return settings.customPromptEnabled ? settings.customPrompt.trim() : "";
}

export function applyCustomPrompt(assembly, rawSettings) {
  if (!isRecord(assembly) || !Array.isArray(assembly.sections)) return assembly;

  const settings = resolveSettings(rawSettings);
  const sections = assembly.sections.filter(
    (section) => !isRecord(section) || section.name !== CUSTOM_PROMPT_SECTION_NAME,
  );
  const customText = settings.customPromptEnabled ? settings.customPrompt.trim() : "";
  if (!customText) {
    return sections.length === assembly.sections.length
      ? assembly
      : { ...assembly, sections };
  }

  const customSection = { name: CUSTOM_PROMPT_SECTION_NAME, text: customText };
  const nextSections = settings.promptPosition === "replace"
    ? [customSection]
    : settings.promptPosition === "prepend"
      ? [customSection, ...sections]
      : [...sections, customSection];
  return { ...assembly, sections: nextSections };
}

export function snapshotSessionEvents(session) {
  if (!isRecord(session)) return [];
  if (typeof session.snapshotEvents === "function") {
    const events = session.snapshotEvents();
    return Array.isArray(events) ? events : [];
  }
  if (Array.isArray(session.events)) return session.events;
  if (Array.isArray(session.log)) return session.log;
  return [];
}

function contentHasVisibleText(content) {
  return Array.isArray(content) && content.some(
    (block) => isRecord(block) && block.type === "text" && typeof block.text === "string" && block.text.trim().length > 0,
  );
}

function streamChunkHasVisibleText(chunk) {
  if (!isRecord(chunk)) return false;
  if (chunk.type === "text-delta") return typeof chunk.text === "string" && chunk.text.trim().length > 0;
  if (chunk.type !== "block-end" || !isRecord(chunk.block)) return false;
  return chunk.block.type === "text" && typeof chunk.block.text === "string" && chunk.block.text.trim().length > 0;
}

function streamHasVisibleText(stream) {
  return Array.isArray(stream) && stream.some((record) => {
    if (!isRecord(record)) return false;
    if (record.type === "text-chunks") {
      return Array.isArray(record.texts) && record.texts.some(
        (text) => typeof text === "string" && text.trim().length > 0,
      );
    }
    return record.type === "chunk" && streamChunkHasVisibleText(record.chunk);
  });
}

export function turnHasAssistantText(events, turn) {
  if (!Array.isArray(events) || typeof turn !== "number") return false;
  let inTurn = false;
  for (const event of events) {
    if (!isRecord(event)) continue;
    if (event.type === "turn/start" && event.data?.turn === turn) {
      inTurn = true;
      continue;
    }
    if (!inTurn) continue;
    if (event.type === "turn/end" && event.data?.turn === turn) break;
    if (event.type === "assistant/message" && (
      contentHasVisibleText(event.data?.message?.content) || streamHasVisibleText(event.data?.stream)
    )) return true;
    if (event.type === "assistant/attempt" && streamHasVisibleText(event.data?.stream)) return true;
    if (event.type === "assistant/live-chunk" && streamChunkHasVisibleText(event.data?.chunk)) return true;
    if (event.type === "assistant/chunk") {
      const chunk = event.data?.chunk;
      if (isRecord(chunk) && (chunk.type === "text-delta" || chunk.type === "text") && typeof chunk.text === "string" && chunk.text.trim().length > 0) return true;
    }
  }
  return false;
}

export function evaluateAutoRetry({
  enabled,
  reasonKind,
  hasAssistantText,
  consecutiveCompleteFailures,
  maxFailures,
}) {
  const current = typeof consecutiveCompleteFailures === "number" && consecutiveCompleteFailures > 0
    ? consecutiveCompleteFailures
    : 0;
  const limit = typeof maxFailures === "number" && maxFailures >= AUTO_RETRY_MIN_FAILURES
    ? maxFailures
    : DEFAULT_SETTINGS.autoRetryMaxFailures;

  if (!enabled) return { action: "idle", consecutiveCompleteFailures: 0 };
  if (reasonKind === "aborted") return { action: "cancel", consecutiveCompleteFailures: 0 };
  if (reasonKind !== "error") return { action: "reset", consecutiveCompleteFailures: 0 };

  const nextCount = hasAssistantText ? 0 : current + 1;
  if (!hasAssistantText && nextCount >= limit) return { action: "stop", consecutiveCompleteFailures: nextCount };
  return { action: "retry", consecutiveCompleteFailures: nextCount };
}

export function createContinueUserMessage(pluginName = name) {
  return deepFreeze({
    id: randomUUID(),
    role: "user",
    content: [{ type: "text", text: AUTO_RETRY_CONTINUE_TEXT }],
    source: { kind: "user", plugin: pluginName, form: "auto-retry" },
  });
}

export function cancellableDelay(delayMs, signal) {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener?.("abort", onAbort);
      resolve(true);
    }, Math.max(0, delayMs));
    function onAbort() {
      clearTimeout(timer);
      resolve(false);
    }
    signal?.addEventListener?.("abort", onAbort, { once: true });
  });
}

export function createAutoRetryEngine({ getSettings, delay = cancellableDelay } = {}) {
  const states = new WeakMap();
  const activeAborts = new Set();

  function stateOf(session) {
    let state = states.get(session);
    if (!state) {
      state = { consecutiveCompleteFailures: 0, abort: null, generation: 0, issuedIds: new Set() };
      states.set(session, state);
    }
    return state;
  }

  function cancel(session) {
    const state = states.get(session);
    if (!state) return;
    state.generation += 1;
    if (!state.abort) return;
    state.abort.abort();
    activeAborts.delete(state.abort);
    state.abort = null;
  }

  function dispose() {
    for (const abort of activeAborts) abort.abort();
    activeAborts.clear();
  }

  async function onSessionEvent(session, event, ctx) {
    if (!isRecord(session) || !isRecord(event)) return;
    const settings = resolveSettings(typeof getSettings === "function" ? getSettings() : undefined);
    const state = stateOf(session);

    if (!settings.autoRetryEnabled) {
      cancel(session);
      state.consecutiveCompleteFailures = 0;
      return;
    }

    if (event.type === "user/message") {
      const message = event.data;
      if (message?.source?.kind === "user" && typeof message.id === "string" && !state.issuedIds.has(message.id)) {
        cancel(session);
        state.consecutiveCompleteFailures = 0;
      }
      return;
    }
    if (event.type !== "turn/end") return;

    const decision = evaluateAutoRetry({
      enabled: settings.autoRetryEnabled,
      reasonKind: event.data?.reason?.kind,
      hasAssistantText: turnHasAssistantText(snapshotSessionEvents(session), event.data?.turn),
      consecutiveCompleteFailures: state.consecutiveCompleteFailures,
      maxFailures: settings.autoRetryMaxFailures,
    });
    state.consecutiveCompleteFailures = decision.consecutiveCompleteFailures;
    if (decision.action !== "retry") {
      cancel(session);
      return;
    }

    cancel(session);
    const abort = new AbortController();
    const generation = state.generation;
    state.abort = abort;
    activeAborts.add(abort);

    const waited = await delay(settings.autoRetryDelaySeconds * 1000, abort.signal);
    activeAborts.delete(abort);
    if (state.abort === abort) state.abort = null;
    if (!waited || abort.signal.aborted || state.generation !== generation) return;

    const liveSettings = resolveSettings(typeof getSettings === "function" ? getSettings() : settings);
    if (!liveSettings.autoRetryEnabled) return;

    const agent = ctx?.agents?.get?.(session.id);
    if (!agent || agent.session !== session || typeof agent.followup !== "function") return;
    if (agent.status === "running" || agent.inbox?.hasPending) return;

    const message = createContinueUserMessage();
    state.issuedIds.add(message.id);
    try {
      agent.followup(message);
    } catch (error) {
      state.issuedIds.delete(message.id);
      ctx?.logger?.warn?.(`[wanglele] auto-retry followup failed: ${error?.message || error}`);
    }
  }

  return { onSessionEvent, cancel, dispose, stateOf };
}

export function apply(ctx, config = {}) {
  const autoRetry = createAutoRetryEngine({ getSettings: () => config });
  ctx.effect(() => () => autoRetry.dispose(), "wanglele: auto-retry dispose");
  ctx.effect(
    () => ctx.systemPrompt.section({
      name: CUSTOM_PROMPT_SECTION_NAME,
      order: 10300,
      text: () => customPromptSectionText(config),
    }),
    "wanglele: custom system prompt",
  );
  ctx.on(
    "system-prompt/assemble",
    async (assembly, _context, next) => applyCustomPrompt(await next(), config),
    { global: true },
  );
  ctx.inject(["settings"], (settingsCtx) => {
    settingsCtx.effect(
      () => settingsCtx.settings.configure({ auto: false }, ctx.fiber),
      "wanglele: custom settings page",
    );
  });
  ctx.on(
    "session/event",
    (session, event) => autoRetry.onSessionEvent(session, event, ctx),
    { global: true },
  );
}
