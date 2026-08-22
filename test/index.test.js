import test from "node:test";
import assert from "node:assert/strict";

import {
  apply,
  applyCustomPrompt,
  applyCustomPromptContext,
  createCustomPromptContextMessage,
  CUSTOM_PROMPT_SECTION_NAME,
  DEFAULT_SETTINGS,
  getVisibleCustomPromptState,
  inject,
  isGeminiFlashModel,
  isGeminiToolStreamFailure,
  isGptModel,
  name,
  patchAssembly,
  patchGptToolSchema,
  patchPwshSchema,
  recoverGeminiToolCallStream,
  resolveSettings,
  WANGLELE_SETTINGS_NS,
} from "../lib/index.js";

function pwshSchema() {
  return {
    name: "pwsh",
    description: "Run PowerShell",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string" },
        description: { type: "string" },
        sandbox_permissions: { type: "string" },
        justification: { type: "string" },
      },
      required: [
        "command",
        "description",
        "sandbox_permissions",
        "justification",
      ],
    },
  };
}

function editSchema() {
  return {
    name: "edit",
    description: "Edit a UTF-8 text file",
    parameters: {
      type: "object",
      properties: {
        file_path: { type: "string" },
        old_string: { type: "string" },
        new_string: { type: "string" },
        replace_all: { type: "boolean" },
        sandbox_permissions: { type: "string" },
        justification: { type: "string" },
      },
      required: [
        "file_path",
        "old_string",
        "new_string",
        "replace_all",
        "sandbox_permissions",
        "justification",
      ],
    },
  };
}

function captureListeners(config = {}, fakeSettings = null) {
  const registrations = [];
  const fakeCtx = {
    inject(services, callback) {
      if (services.includes("settings") && fakeSettings) {
        callback({ settings: fakeSettings });
      }
    },
    on(event, listener, options) {
      const registration = { event, listener, options };
      registrations.push(registration);
      return () => true;
    },
  };

  apply(fakeCtx, config);
  return registrations;
}

function capturePreStepListener(config = {}, fakeSettings = null) {
  return captureListeners(config, fakeSettings).find(
    (registration) => registration.event === "agent/pre-step",
  );
}

function captureAssemblyListener(config = {}, fakeSettings = null) {
  return captureListeners(config, fakeSettings).find(
    (registration) => registration.event === "system-prompt/assemble",
  );
}

function captureStreamListener(config = {}) {
  return captureListeners(config).find(
    (registration) => registration.event === "llm/stream",
  );
}

async function collect(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

test("exports plugin constants and metadata", () => {
  assert.equal(name, "wanglele");
  assert.deepEqual(inject, ["systemPrompt", "agents"]);
  assert.equal(WANGLELE_SETTINGS_NS, "wanglele");
  assert.equal(CUSTOM_PROMPT_SECTION_NAME, "wanglele:custom-system-prompt");
  assert.equal(DEFAULT_SETTINGS.customPromptEnabled, false);
  assert.equal(DEFAULT_SETTINGS.promptPosition, "append");
  assert.equal(DEFAULT_SETTINGS.textareaHeight, 280);
});

test("resolves raw settings with default fallbacks", () => {
  assert.deepEqual(resolveSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(resolveSettings({}), DEFAULT_SETTINGS);

  const custom = resolveSettings({
    customPromptEnabled: true,
    customPrompt: "Hello Agent",
    promptPosition: "prepend",
    textareaHeight: 450,
  });

  assert.equal(custom.customPromptEnabled, true);
  assert.equal(custom.customPrompt, "Hello Agent");
  assert.equal(custom.promptPosition, "prepend");
  assert.equal(custom.textareaHeight, 450);
  assert.equal(custom.gptCompatEnabled, true);
});

test("applyCustomPrompt injects custom prompt in append mode (default)", () => {
  const baseAssembly = {
    sections: [{ name: "base:prompt", text: "You are an AI." }],
  };

  const result = applyCustomPrompt(baseAssembly, {
    customPromptEnabled: true,
    customPrompt: "You are a specialized coding agent.",
    promptPosition: "append",
  });

  assert.equal(result.sections.length, 2);
  assert.equal(result.sections[0].name, "base:prompt");
  assert.equal(result.sections[1].name, CUSTOM_PROMPT_SECTION_NAME);
  assert.equal(result.sections[1].text, "You are a specialized coding agent.");
});

test("applyCustomPrompt injects custom prompt in prepend mode", () => {
  const baseAssembly = {
    sections: [{ name: "base:prompt", text: "You are an AI." }],
  };

  const result = applyCustomPrompt(baseAssembly, {
    customPromptEnabled: true,
    customPrompt: "Priority Rule: Answer in Chinese.",
    promptPosition: "prepend",
  });

  assert.equal(result.sections.length, 2);
  assert.equal(result.sections[0].name, CUSTOM_PROMPT_SECTION_NAME);
  assert.equal(result.sections[0].text, "Priority Rule: Answer in Chinese.");
  assert.equal(result.sections[1].name, "base:prompt");
});

test("applyCustomPrompt replaces all sections in replace mode", () => {
  const baseAssembly = {
    sections: [
      { name: "harness:identity", text: "DeepSeek Harness" },
      { name: "base:persona", text: "Standard Persona" },
    ],
  };

  const result = applyCustomPrompt(baseAssembly, {
    customPromptEnabled: true,
    customPrompt: "Standalone system prompt",
    promptPosition: "replace",
  });

  assert.equal(result.sections.length, 1);
  assert.equal(result.sections[0].name, CUSTOM_PROMPT_SECTION_NAME);
  assert.equal(result.sections[0].text, "Standalone system prompt");
});

test("applyCustomPrompt skips injection if disabled or empty text", () => {
  const baseAssembly = {
    sections: [{ name: "base:prompt", text: "You are an AI." }],
  };

  const disabledResult = applyCustomPrompt(baseAssembly, {
    customPromptEnabled: false,
    customPrompt: "Some prompt",
  });
  assert.equal(disabledResult, baseAssembly);

  const emptyResult = applyCustomPrompt(baseAssembly, {
    customPromptEnabled: true,
    customPrompt: "   ",
  });
  assert.equal(emptyResult, baseAssembly);
});

test("createCustomPromptContextMessage builds valid frozen DSH context user message", () => {
  const msg = createCustomPromptContextMessage("My Custom Prompt", "wanglele");
  assert.equal(msg.role, "user");
  assert.equal(typeof msg.id, "string");
  assert.deepEqual(msg.content, [{ type: "text", text: "My Custom Prompt" }]);
  assert.deepEqual(msg.source, { kind: "plugin", plugin: "wanglele" });
  assert.equal(Object.isFrozen(msg), true);
});

test("applyCustomPromptContext injects in append mode (default)", () => {
  const userMsg = { role: "user", content: [{ type: "text", text: "Hello" }] };
  const result = applyCustomPromptContext([userMsg], {
    customPromptEnabled: true,
    customPrompt: "Always respond politely.",
    promptPosition: "append",
  });

  assert.equal(result.length, 2);
  assert.equal(result[0], userMsg);
  assert.equal(result[1].role, "user");
  assert.equal(result[1].content[0].text, "Always respond politely.");
  assert.equal(result[1].source.plugin, "wanglele");
});

test("applyCustomPromptContext injects in prepend mode", () => {
  const userMsg = { role: "user", content: [{ type: "text", text: "Hello" }] };
  const result = applyCustomPromptContext([userMsg], {
    customPromptEnabled: true,
    customPrompt: "Always respond politely.",
    promptPosition: "prepend",
  });

  assert.equal(result.length, 2);
  assert.equal(result[0].role, "user");
  assert.equal(result[0].content[0].text, "Always respond politely.");
  assert.equal(result[1], userMsg);
});

test("applyCustomPromptContext replaces messages in replace mode", () => {
  const userMsg = { role: "user", content: [{ type: "text", text: "Hello" }] };
  const result = applyCustomPromptContext([userMsg], {
    customPromptEnabled: true,
    customPrompt: "Replaced content",
    promptPosition: "replace",
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].content[0].text, "Replaced content");
});

test("applyCustomPromptContext skips when disabled or empty", () => {
  const userMsg = { role: "user", content: [{ type: "text", text: "Hello" }] };
  const disabled = applyCustomPromptContext([userMsg], {
    customPromptEnabled: false,
    customPrompt: "Test",
  });
  assert.deepEqual(disabled, [userMsg]);

  const empty = applyCustomPromptContext([userMsg], {
    customPromptEnabled: true,
    customPrompt: "   ",
  });
  assert.deepEqual(empty, [userMsg]);
});

test("hot-reloads custom context injection during agent pre-step", async () => {
  let watcherCallback = null;
  let storedSettings = {
    customPromptEnabled: false,
    customPrompt: "",
    promptPosition: "append",
  };

  const fakeSettingsService = {
    register(ns, schema, opts) {
      assert.equal(ns, "wanglele");
      return {
        get: () => storedSettings,
        watch: (cb) => {
          watcherCallback = cb;
        },
      };
    },
  };

  const registration = capturePreStepListener({}, fakeSettingsService);
  const userMsg = { role: "user", content: [{ type: "text", text: "User Input" }] };

  // Turn 1, Step 1: Disabled
  let decision1 = await registration.listener(
    { agent: { session: { events: [], surface: { nodes: [] } } }, turn: 1, step: 1, signal: {} },
    async () => ({ kind: "enter", messages: [userMsg] }),
  );
  assert.equal(decision1.messages.length, 1);

  // Turn 1, Step 2: Skip non-first step
  storedSettings = {
    customPromptEnabled: true,
    customPrompt: "Live Custom Prompt",
    promptPosition: "append",
  };
  watcherCallback(storedSettings);

  let decisionStep2 = await registration.listener(
    { agent: { session: { events: [], surface: { nodes: [] } } }, turn: 1, step: 2, signal: {} },
    async () => ({ kind: "enter", messages: [userMsg] }),
  );
  assert.equal(decisionStep2.messages.length, 1);

  // Turn 2, Step 1: Active and injected
  const agentSession = {
    events: [],
    surface: { nodes: [] },
  };
  let decision2 = await registration.listener(
    { agent: { session: agentSession }, turn: 2, step: 1, signal: {} },
    async () => ({ kind: "enter", messages: [userMsg] }),
  );
  assert.equal(decision2.messages.length, 2);
  assert.equal(decision2.messages[1].content[0].text, "Live Custom Prompt");
  assert.equal(decision2.messages[1].source.plugin, "wanglele");

  // Simulate DSH recording the injected message into session events & surface
  agentSession.events.push({
    seq: 0,
    type: "user/message",
    data: decision2.messages[1],
  });
  agentSession.surface.nodes.push(0);

  // Turn 3, Step 1 (Subsequent turn): Should NOT re-inject because it's already visible in surface.nodes!
  let decision3 = await registration.listener(
    { agent: { session: agentSession }, turn: 3, step: 1, signal: {} },
    async () => ({ kind: "enter", messages: [userMsg] }),
  );
  assert.equal(decision3.messages.length, 1, "Subsequent turn should skip injection if visible");

  // Context Compaction occurs: surface.nodes no longer contains seq 0
  agentSession.surface.nodes = [];

  // Turn 4, Step 1 (After compaction): Automatically RE-INJECTS!
  let decision4 = await registration.listener(
    { agent: { session: agentSession }, turn: 4, step: 1, signal: {} },
    async () => ({ kind: "enter", messages: [userMsg] }),
  );
  assert.equal(decision4.messages.length, 2, "Re-injects after context compaction clears surface nodes");
  assert.equal(decision4.messages[1].content[0].text, "Live Custom Prompt");

  // Prompt updated dynamically
  storedSettings = {
    customPromptEnabled: true,
    customPrompt: "Updated Prompt Content",
    promptPosition: "append",
  };
  watcherCallback(storedSettings);

  // Add the newly injected message to events and surface
  agentSession.events.push({
    seq: 1,
    type: "user/message",
    data: decision4.messages[1],
  });
  agentSession.surface.nodes.push(1);

  // Turn 5, Step 1 (Prompt changed): RE-INJECTS new prompt!
  let decision5 = await registration.listener(
    { agent: { session: agentSession }, turn: 5, step: 1, signal: {} },
    async () => ({ kind: "enter", messages: [userMsg] }),
  );
  assert.equal(decision5.messages.length, 2, "Re-injects when custom prompt text is updated");
  assert.equal(decision5.messages[1].content[0].text, "Updated Prompt Content");
});

test("matches only conservative GPT model identifiers", () => {
  assert.equal(isGptModel("gpt-5.6-sol"), true);
  assert.equal(isGptModel("GPT-4o"), true);
  assert.equal(isGptModel("gpt"), true);
  assert.equal(isGptModel("chatgpt-4o"), false);
  assert.equal(isGptModel("deepseek-v3.2"), false);
  assert.equal(isGptModel("claude-sonnet-4-6"), false);
  assert.equal(isGptModel(undefined), false);
});

test("matches conservative Gemini 3 Flash model identifiers", () => {
  assert.equal(isGeminiFlashModel("gemini-3.7-flash"), true);
  assert.equal(isGeminiFlashModel("GEMINI-3.1-FLASH-preview"), true);
  assert.equal(isGeminiFlashModel("gemini-3-flash"), true);
  assert.equal(isGeminiFlashModel("gemini-2.5-flash"), false);
  assert.equal(isGeminiFlashModel("gemini-3.7-pro"), false);
  assert.equal(isGeminiFlashModel("gpt-5.6-terra"), false);
  assert.equal(isGeminiFlashModel(undefined), false);
});

test("removes GPT-unsafe fields from the pwsh schema", () => {
  const original = pwshSchema();
  const patched = patchPwshSchema(original);

  assert.notEqual(patched, original);
  assert.notEqual(patched.parameters, original.parameters);
  assert.deepEqual(Object.keys(patched.parameters.properties), [
    "command",
    "description",
  ]);
  assert.deepEqual(patched.parameters.required, ["command", "description"]);
  assert.equal(
    Object.hasOwn(original.parameters.properties, "sandbox_permissions"),
    true,
  );
});

test("removes GPT-unsafe fields from the edit schema", () => {
  const original = editSchema();
  const patched = patchGptToolSchema(original);

  assert.notEqual(patched, original);
  assert.deepEqual(Object.keys(patched.parameters.properties), [
    "file_path",
    "old_string",
    "new_string",
    "replace_all",
  ]);
  assert.deepEqual(patched.parameters.required, [
    "file_path",
    "old_string",
    "new_string",
    "replace_all",
  ]);
  assert.equal(
    Object.hasOwn(original.parameters.properties, "sandbox_permissions"),
    true,
  );
});

test("changes only supported GPT tools and keeps malformed schemas harmless", () => {
  const otherTool = {
    name: "fs_read",
    parameters: { type: "object", properties: { path: { type: "string" } } },
  };
  const malformedPwsh = { name: "pwsh", parameters: null };
  const original = {
    sections: [],
    contexts: [],
    variables: { model: "gpt-5.6-terra" },
    tools: [otherTool, malformedPwsh, pwshSchema(), editSchema()],
  };

  const patched = patchAssembly(original);
  assert.notEqual(patched, original);
  assert.equal(patched.tools[0], otherTool);
  assert.equal(patched.tools[1], malformedPwsh);
  assert.notEqual(patched.tools[2], original.tools[2]);
  assert.notEqual(patched.tools[3], original.tools[3]);
  assert.equal(patchAssembly(patched), patched);
});

test("patches the value returned by downstream GPT assembly listeners", async () => {
  const registration = captureAssemblyListener();
  const downstream = {
    sections: [],
    contexts: [],
    variables: { model: "gpt-5.6-sol" },
    tools: [pwshSchema()],
  };

  const result = await registration.listener(
    { tools: [] },
    {},
    async () => downstream,
  );

  assert.notEqual(result, downstream);
  assert.equal(
    Object.hasOwn(
      result.tools[0].parameters.properties,
      "sandbox_permissions",
    ),
    false,
  );
  assert.equal(
    Object.hasOwn(result.tools[0].parameters.properties, "justification"),
    false,
  );
});

test("uses the agent option as a GPT fallback during assembly", async () => {
  const registration = captureAssemblyListener();
  const downstream = {
    sections: [],
    contexts: [],
    variables: {},
    tools: [pwshSchema()],
  };

  const result = await registration.listener(
    downstream,
    { agent: { options: { model: "gpt-4.1" } } },
    async () => downstream,
  );

  assert.notEqual(result, downstream);
});

test("patches Gemini 3 Flash assemblies with the same unsafe-field removal", async () => {
  const registration = captureAssemblyListener();
  const downstream = {
    sections: [],
    contexts: [],
    variables: { model: "gemini-3.7-flash" },
    tools: [pwshSchema(), editSchema()],
  };

  const result = await registration.listener(
    downstream,
    {},
    async () => downstream,
  );

  assert.notEqual(result, downstream);
  for (const tool of result.tools) {
    assert.equal(
      Object.hasOwn(tool.parameters.properties, "sandbox_permissions"),
      false,
    );
    assert.equal(
      Object.hasOwn(tool.parameters.properties, "justification"),
      false,
    );
  }
});

for (const model of ["deepseek-v3.2", "claude-sonnet-4-6", undefined]) {
  test(`leaves ${model ?? "missing-model"} assemblies untouched`, async () => {
    const registration = captureAssemblyListener();
    const downstream = {
      sections: [],
      contexts: [],
      variables: { model },
      tools: [pwshSchema()],
    };

    const result = await registration.listener(
      downstream,
      {},
      async () => downstream,
    );

    assert.equal(result, downstream);
    assert.equal(result.tools[0], downstream.tools[0]);
    assert.equal(
      Object.hasOwn(
        result.tools[0].parameters.properties,
        "sandbox_permissions",
      ),
      true,
    );
  });
}

test("recognizes the malformed Gemini tool-stream failure", () => {
  assert.equal(
    isGeminiToolStreamFailure({
      kind: "error",
      failure: {
        message: "Cannot read properties of undefined (reading 'startsWith')",
      },
    }),
    true,
  );
  assert.equal(
    isGeminiToolStreamFailure({
      kind: "error",
      failure: { message: "invalid request" },
    }),
    false,
  );
  assert.equal(isGeminiToolStreamFailure({ kind: "tool-calls" }), false);
});

test("recovers an incomplete Gemini tool call from accumulated stream chunks", async () => {
  const source = (async function* () {
    yield { type: "block-start", index: 0, blockType: "tool-call" };
    yield {
      type: "tool-call-delta",
      index: 0,
      id: "call-1",
      name: "pwsh",
      argumentsDelta: '{"command":"pwd"}',
    };
    yield {
      type: "usage",
      usage: { inputTokens: 10, outputTokens: 5 },
    };
    yield {
      type: "finish",
      reason: {
        kind: "error",
        failure: {
          message: "Cannot read properties of undefined (reading 'startsWith')",
          code: "PI_AI_ERROR",
        },
      },
    };
  })();

  const result = await collect(
    recoverGeminiToolCallStream("gemini-3.7-flash", source),
  );

  assert.deepEqual(result, [
    { type: "block-start", index: 0, blockType: "tool-call" },
    {
      type: "tool-call-delta",
      index: 0,
      id: "call-1",
      name: "pwsh",
      argumentsDelta: '{"command":"pwd"}',
    },
    { type: "usage", usage: { inputTokens: 10, outputTokens: 5 } },
    {
      type: "block-end",
      index: 0,
      block: {
        type: "tool-call",
        id: "call-1",
        name: "pwsh",
        arguments: '{"command":"pwd"}',
      },
    },
    { type: "finish", reason: { kind: "tool-calls" } },
  ]);
});

test("closes an open reasoning block before recovered Gemini tool calls", async () => {
  const source = (async function* () {
    yield { type: "block-start", index: 0, blockType: "reasoning" };
    yield { type: "reasoning-delta", index: 0, text: "thinking" };
    yield { type: "block-start", index: 1, blockType: "tool-call" };
    yield {
      type: "tool-call-delta",
      index: 1,
      id: "call-4",
      name: "pwsh",
      argumentsDelta: "{}",
    };
    yield {
      type: "finish",
      reason: {
        kind: "error",
        failure: {
          message: "Cannot read properties of undefined (reading 'startsWith')",
        },
      },
    };
  })();

  const result = await collect(
    recoverGeminiToolCallStream("gemini-3.7-flash", source),
  );

  assert.deepEqual(result.slice(-3), [
    {
      type: "block-end",
      index: 0,
      block: { type: "reasoning", text: "thinking" },
    },
    {
      type: "block-end",
      index: 1,
      block: {
        type: "tool-call",
        id: "call-4",
        name: "pwsh",
        arguments: "{}",
      },
    },
    { type: "finish", reason: { kind: "tool-calls" } },
  ]);
});

test("recovers the same Gemini failure when the stream throws directly", async () => {
  const source = (async function* () {
    yield { type: "block-start", index: 2, blockType: "tool-call" };
    yield {
      type: "tool-call-delta",
      index: 2,
      id: "call-2",
      name: "edit",
      argumentsDelta: '{"file_path":"x"}',
    };
    throw new TypeError(
      "Cannot read properties of undefined (reading 'startsWith')",
    );
  })();

  const result = await collect(
    recoverGeminiToolCallStream("gemini-3.7-flash", source),
  );

  assert.deepEqual(result.at(-1), {
    type: "finish",
    reason: { kind: "tool-calls" },
  });
  assert.deepEqual(result.at(-2), {
    type: "block-end",
    index: 2,
    block: {
      type: "tool-call",
      id: "call-2",
      name: "edit",
      arguments: '{"file_path":"x"}',
    },
  });
});

test("leaves unrelated failures and non-Gemini streams unchanged", async () => {
  const unrelated = {
    type: "finish",
    reason: {
      kind: "error",
      failure: { message: "upstream unavailable", code: "SERVER" },
    },
  };
  const source = (async function* () {
    yield { type: "block-start", index: 0, blockType: "tool-call" };
    yield unrelated;
  })();

  assert.deepEqual(
    await collect(recoverGeminiToolCallStream("gemini-3.7-flash", source)),
    [
      { type: "block-start", index: 0, blockType: "tool-call" },
      unrelated,
    ],
  );

  const nonGeminiSource = (async function* () {
    yield unrelated;
  })();
  const nonGeminiResult = await collect(
    recoverGeminiToolCallStream("deepseek-v4-flash", nonGeminiSource),
  );
  assert.deepEqual(nonGeminiResult, [unrelated]);
});

test("registers the Gemini stream recovery waterfall", async () => {
  const registration = captureStreamListener();
  assert.deepEqual(registration.options, { global: true });

  const source = (async function* () {
    yield { type: "block-start", index: 0, blockType: "tool-call" };
    yield {
      type: "tool-call-delta",
      index: 0,
      id: "call-3",
      name: "pwsh",
      argumentsDelta: "{}",
    };
    yield {
      type: "finish",
      reason: {
        kind: "error",
        failure: {
          message: "Cannot read properties of undefined (reading 'startsWith')",
        },
      },
    };
  })();

  const result = await collect(
    registration.listener({ model: "gemini-3.7-flash" }, () => source),
  );
  assert.equal(result.at(-1).reason.kind, "tool-calls");
});
