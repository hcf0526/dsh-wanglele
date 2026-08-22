import test from "node:test";
import assert from "node:assert/strict";

import {
  apply,
  inject,
  isGeminiFlashModel,
  isGeminiToolStreamFailure,
  isGptModel,
  name,
  patchAssembly,
  patchGptToolSchema,
  patchPwshSchema,
  recoverGeminiToolCallStream,
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

function captureListeners() {
  const registrations = [];
  apply({
    on(event, listener, options) {
      const registration = { event, listener, options };
      registrations.push(registration);
      return () => true;
    },
  });
  return registrations;
}

function captureAssemblyListener() {
  return captureListeners().find(
    (registration) => registration.event === "system-prompt/assemble",
  );
}

function captureStreamListener() {
  return captureListeners().find(
    (registration) => registration.event === "llm/stream",
  );
}

async function collect(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

test("exports a globally scoped DSH compatibility plugin", () => {
  assert.equal(name, "gpt-pwsh-compat");
  assert.deepEqual(inject, ["systemPrompt", "agents"]);

  const registrations = captureListeners();
  assert.equal(registrations.length, 2);
  const assembly = registrations.find(
    (registration) => registration.event === "system-prompt/assemble",
  );
  const stream = registrations.find(
    (registration) => registration.event === "llm/stream",
  );
  assert.deepEqual(assembly.options, { global: true });
  assert.deepEqual(stream.options, { global: true });
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
