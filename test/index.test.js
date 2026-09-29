import test from "node:test";
import assert from "node:assert/strict";

import {
  apply,
  applyCustomPrompt,
  AUTO_RETRY_CONTINUE_TEXT,
  Config,
  CUSTOM_PROMPT_SECTION_NAME,
  createAutoRetryEngine,
  customPromptSectionText,
  createContinueUserMessage,
  DEFAULT_SETTINGS,
  evaluateAutoRetry,
  inject,
  name,
  resolveSettings,
  snapshotSessionEvents,
  turnHasAssistantText,
  WANGLELE_SETTINGS_NS,
} from "../lib/index.js";

function capturePlugin(config = {}) {
  const registrations = [];
  const settingsCalls = [];
  const promptSections = [];
  const fakeCtx = {
    inject(services, callback) {
      if (!services.includes("settings")) return;
      callback({
        settings: {
          configure(presentation, owner) {
            settingsCalls.push({ presentation, owner });
            return () => {};
          },
        },
        effect: (effect) => effect(),
      });
    },
    on(event, listener, options) {
      registrations.push({ event, listener, options });
      return () => true;
    },
    effect: (effect) => effect(),
    fiber: { id: "plugin-fiber" },
    systemPrompt: {
      section(section) {
        promptSections.push(section);
        return () => {};
      },
    },
  };
  apply(fakeCtx, config);
  return { registrations, settingsCalls, promptSections };
}

test("exports the current DSH plugin metadata", () => {
  assert.equal(name, "wanglele");
  assert.deepEqual(inject, ["agents", "systemPrompt"]);
  assert.equal(WANGLELE_SETTINGS_NS, "wanglele");
  assert.equal(CUSTOM_PROMPT_SECTION_NAME, "wanglele:custom-system-prompt");
  assert.deepEqual(DEFAULT_SETTINGS, {
    autoRetryEnabled: false,
    autoRetryDelaySeconds: 5,
    autoRetryMaxFailures: 3,
    customPromptEnabled: false,
    customPrompt: "",
    promptPosition: "append",
  });
});

test("Config validates auto-retry and custom-prompt volatile fields", () => {
  const parsed = Config["~standard"].validate({
    autoRetryEnabled: true,
    autoRetryDelaySeconds: 12,
    autoRetryMaxFailures: 4,
    customPromptEnabled: true,
    customPrompt: "Follow these project rules.",
    promptPosition: "replace",
  });
  assert.equal(parsed.issues, undefined);
  const settings = resolveSettings(parsed.value);
  assert.equal(settings.autoRetryEnabled, true);
  assert.equal(settings.autoRetryDelaySeconds, 12);
  assert.equal(settings.autoRetryMaxFailures, 4);
  assert.equal(settings.customPromptEnabled, true);
  assert.equal(settings.customPrompt, "Follow these project rules.");
  assert.equal(settings.promptPosition, "replace");
  assert.equal(typeof Config.toJSON(), "object");
});

test("resolves auto-retry settings with bounds", () => {
  assert.deepEqual(resolveSettings(undefined), DEFAULT_SETTINGS);
  const settings = resolveSettings({ autoRetryEnabled: true, autoRetryDelaySeconds: 8.4, autoRetryMaxFailures: 0 });
  assert.equal(settings.autoRetryEnabled, true);
  assert.equal(settings.autoRetryDelaySeconds, 8);
  assert.equal(settings.autoRetryMaxFailures, 1);
});

test("custom prompt section is empty while disabled and trims active text", () => {
  assert.equal(customPromptSectionText({ customPromptEnabled: false, customPrompt: "Ignored" }), "");
  assert.equal(customPromptSectionText({ customPromptEnabled: true, customPrompt: "  Follow project rules.  " }), "Follow project rules.");
});

test("custom prompt supports append, prepend, and replace positions", () => {
  const assembly = {
    sections: [
      { name: "core:identity", text: "Identity" },
      { name: CUSTOM_PROMPT_SECTION_NAME, text: "Old prompt" },
      { name: "core:tools", text: "Tools" },
    ],
  };
  const makeSettings = (promptPosition) => ({
    customPromptEnabled: true,
    customPrompt: "Project rules",
    promptPosition,
  });

  assert.deepEqual(
    applyCustomPrompt(assembly, makeSettings("append")).sections.map(({ name }) => name),
    ["core:identity", "core:tools", CUSTOM_PROMPT_SECTION_NAME],
  );
  assert.deepEqual(
    applyCustomPrompt(assembly, makeSettings("prepend")).sections.map(({ name }) => name),
    [CUSTOM_PROMPT_SECTION_NAME, "core:identity", "core:tools"],
  );
  assert.deepEqual(
    applyCustomPrompt(assembly, makeSettings("replace")).sections.map(({ name }) => name),
    [CUSTOM_PROMPT_SECTION_NAME],
  );
  assert.equal(applyCustomPrompt(assembly, { customPromptEnabled: false }).sections.length, 2);
});

test("evaluates retry decisions", () => {
  assert.deepEqual(evaluateAutoRetry({ enabled: false, reasonKind: "error", hasAssistantText: false, consecutiveCompleteFailures: 0, maxFailures: 3 }), { action: "idle", consecutiveCompleteFailures: 0 });
  assert.deepEqual(evaluateAutoRetry({ enabled: true, reasonKind: "error", hasAssistantText: false, consecutiveCompleteFailures: 0, maxFailures: 3 }), { action: "retry", consecutiveCompleteFailures: 1 });
  assert.deepEqual(evaluateAutoRetry({ enabled: true, reasonKind: "error", hasAssistantText: false, consecutiveCompleteFailures: 2, maxFailures: 3 }), { action: "stop", consecutiveCompleteFailures: 3 });
  assert.deepEqual(evaluateAutoRetry({ enabled: true, reasonKind: "error", hasAssistantText: true, consecutiveCompleteFailures: 2, maxFailures: 3 }), { action: "retry", consecutiveCompleteFailures: 0 });
});

test("creates visible Continue user message", () => {
  const message = createContinueUserMessage();
  assert.equal(message.role, "user");
  assert.equal(message.content[0].text, AUTO_RETRY_CONTINUE_TEXT);
  assert.deepEqual(message.source, { kind: "user", plugin: "wanglele", form: "auto-retry" });
  assert.equal(typeof message.id, "string");
});

test("uses the RC2 session log and falls back to the legacy events array", () => {
  const rc2Log = [{ type: "turn/start", data: { turn: 1 } }];
  const legacyEvents = [{ type: "turn/start", data: { turn: 2 } }];
  assert.equal(snapshotSessionEvents({ log: rc2Log, events: legacyEvents }), rc2Log);
  assert.equal(snapshotSessionEvents({ events: legacyEvents }), legacyEvents);
  assert.deepEqual(snapshotSessionEvents({}), []);
});

test("turnHasAssistantText reads current DSH session log events", () => {
  const events = [
    { type: "turn/start", data: { turn: 2 } },
    { type: "assistant/message", data: { message: { content: [{ type: "text", text: "hello" }] } } },
    { type: "turn/end", data: { turn: 2, reason: { kind: "error" } } },
  ];
  assert.equal(turnHasAssistantText(events, 2), true);
  assert.equal(turnHasAssistantText(events, 3), false);
});

test("turnHasAssistantText reads 0.2 assistant attempt stream records", () => {
  const packedStreamEvents = [
    { type: "turn/start", data: { turn: 3 } },
    {
      type: "assistant/attempt",
      data: {
        turn: 3,
        step: 0,
        stream: [{ type: "text-chunks", time0: 10, index: 0, dt: [], texts: ["partial output"] }],
      },
    },
    { type: "turn/end", data: { turn: 3, reason: { kind: "error" } } },
  ];
  assert.equal(turnHasAssistantText(packedStreamEvents, 3), true);

  const rawChunkEvents = [
    { type: "turn/start", data: { turn: 4 } },
    {
      type: "assistant/attempt",
      data: {
        turn: 4,
        step: 0,
        stream: [{ type: "chunk", time: 10, chunk: { type: "text-delta", index: 0, text: "partial output" } }],
      },
    },
    { type: "turn/end", data: { turn: 4, reason: { kind: "error" } } },
  ];
  assert.equal(turnHasAssistantText(rawChunkEvents, 4), true);
});

test("auto-retry engine sends Continue after a failed DSH turn", async () => {
  const events = [
    { type: "turn/start", data: { turn: 1 } },
    { type: "turn/end", data: { turn: 1, reason: { kind: "error", error: { message: "failed", code: "UNKNOWN" } } } },
  ];
  const session = { id: "session-1", log: events, snapshotEvents: () => assert.fail("RC2 deprecated snapshotEvents() must not be called") };
  const sent = [];
  const agent = { session, status: "idle", inbox: { hasPending: false }, followup: (message) => sent.push(message) };
  const engine = createAutoRetryEngine({
    getSettings: () => ({ autoRetryEnabled: true, autoRetryDelaySeconds: 1, autoRetryMaxFailures: 3 }),
    delay: async () => true,
  });
  await engine.onSessionEvent(session, events[1], { agents: { get: () => agent } });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].content[0].text, "继续");
  engine.dispose();
});

test("apply registers a dynamic system-prompt section and configures settings", () => {
  const { registrations, settingsCalls, promptSections } = capturePlugin();
  assert.deepEqual(registrations.map(({ event }) => event), ["system-prompt/assemble", "session/event"]);
  assert.equal(registrations[0].options.global, true);
  assert.equal(registrations[1].options.global, true);
  assert.deepEqual(settingsCalls.map(({ presentation }) => presentation), [{ auto: false }]);
  assert.equal(promptSections.length, 1);
  assert.equal(promptSections[0].name, CUSTOM_PROMPT_SECTION_NAME);
  assert.equal(promptSections[0].order, 10300);
  assert.equal(promptSections[0].text(), "");
});

test("system-prompt waterfall applies live prompt position settings", async () => {
  const { registrations, promptSections } = capturePlugin({
    customPromptEnabled: true,
    customPrompt: "  Answer in concise Chinese.  ",
    promptPosition: "prepend",
  });
  const assembly = {
    sections: [
      { name: "core:identity", text: "Identity" },
      { name: CUSTOM_PROMPT_SECTION_NAME, text: promptSections[0].text() },
    ],
  };
  const result = await registrations[0].listener(assembly, {}, async () => assembly);
  assert.deepEqual(result.sections.map(({ name }) => name), [CUSTOM_PROMPT_SECTION_NAME, "core:identity"]);
  assert.equal(result.sections[0].text, "Answer in concise Chinese.");
});

test("session event listener uses the current two-argument event contract", async () => {
  const { registrations } = capturePlugin({ autoRetryEnabled: false });
  const sessionListener = registrations.find(({ event }) => event === "session/event");
  const session = { id: "session-2", snapshotEvents: () => [] };
  await sessionListener.listener(session, { type: "turn/end", data: { turn: 1, reason: { kind: "error" } } });
});
