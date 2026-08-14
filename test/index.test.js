import test from "node:test";
import assert from "node:assert/strict";

import {
  apply,
  deepSeekRetryDelay,
  inject,
  isDeepSeekModel,
  isGptModel,
  name,
  patchAssembly,
  patchPwshSchema,
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

function captureListeners(internals) {
  const registrations = [];
  apply(
    {
      on(event, listener, options) {
        const registration = { event, listener, options };
        registrations.push(registration);
        return () => true;
      },
    },
    {},
    internals,
  );
  return registrations;
}

function captureAssemblyListener() {
  return captureListeners().find(
    (registration) => registration.event === "system-prompt/assemble",
  );
}

function captureRequestErrorListener(wait) {
  return captureListeners({ wait }).find(
    (registration) => registration.event === "agent/request-error",
  );
}

test("exports a globally scoped DSH plugin", () => {
  assert.equal(name, "gpt-pwsh-compat");
  assert.deepEqual(inject, ["systemPrompt", "agents"]);

  const registration = captureAssemblyListener();
  assert.equal(registration.event, "system-prompt/assemble");
  assert.deepEqual(registration.options, { global: true });
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

test("changes only the pwsh tool and keeps malformed schemas harmless", () => {
  const otherTool = {
    name: "fs_read",
    parameters: { type: "object", properties: { path: { type: "string" } } },
  };
  const malformedPwsh = { name: "pwsh", parameters: null };
  const original = {
    sections: [],
    contexts: [],
    variables: { model: "gpt-5.6-terra" },
    tools: [otherTool, malformedPwsh, pwshSchema()],
  };

  const patched = patchAssembly(original);
  assert.notEqual(patched, original);
  assert.equal(patched.tools[0], otherTool);
  assert.equal(patched.tools[1], malformedPwsh);
  assert.notEqual(patched.tools[2], original.tools[2]);
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

test("matches conservative DeepSeek model identifiers", () => {
  assert.equal(isDeepSeekModel("deepseek-v3.2"), true);
  assert.equal(isDeepSeekModel("DeepSeek-R1"), true);
  assert.equal(isDeepSeekModel("deepseek"), true);
  assert.equal(isDeepSeekModel("my-deepseek-v3"), false);
  assert.equal(isDeepSeekModel("gpt-5.6-sol"), false);
  assert.equal(isDeepSeekModel(undefined), false);
});

test("maps DeepSeek 503 and 429 failures to fixed retry delays", () => {
  assert.equal(deepSeekRetryDelay("deepseek-v3.2", { status: 503 }), 10_000);
  assert.equal(deepSeekRetryDelay("deepseek-r1", { status: 429 }), 30_000);
  assert.equal(deepSeekRetryDelay("deepseek-v3.2", { status: 500 }), undefined);
  assert.equal(deepSeekRetryDelay("gpt-5.6-sol", { status: 503 }), undefined);
  assert.equal(deepSeekRetryDelay("deepseek-v3.2", null), undefined);
});

test("retries DeepSeek 503 and 429 responses after their fixed waits", async () => {
  const waits = [];
  const registration = captureRequestErrorListener(async (delayMs, signal) => {
    waits.push({ delayMs, signal });
    return true;
  });
  assert.deepEqual(registration.options, { global: true, prepend: true });

  for (const [status, delayMs] of [
    [503, 10_000],
    [429, 30_000],
  ]) {
    const controller = new AbortController();
    let delegated = false;
    const result = await registration.listener(
      {
        agent: { options: { model: "deepseek-v3.2" } },
        failure: { status },
        signal: controller.signal,
      },
      async () => {
        delegated = true;
        return undefined;
      },
    );

    assert.deepEqual(result, { kind: "retry" });
    assert.equal(delegated, false);
    assert.equal(waits.at(-1).delayMs, delayMs);
    assert.equal(waits.at(-1).signal, controller.signal);
  }
});

test("delegates unrelated failures and cancels a pending DeepSeek retry", async () => {
  const registration = captureRequestErrorListener(async () => false);
  let delegated = 0;
  const next = async () => {
    delegated += 1;
    return { kind: "downstream" };
  };

  assert.deepEqual(
    await registration.listener(
      {
        agent: { options: { model: "gpt-5.6-sol" } },
        failure: { status: 503 },
        signal: new AbortController().signal,
      },
      next,
    ),
    { kind: "downstream" },
  );

  assert.equal(
    await registration.listener(
      {
        agent: { options: { model: "deepseek-v3.2" } },
        failure: { status: 503 },
        signal: new AbortController().signal,
      },
      next,
    ),
    undefined,
  );
  assert.equal(delegated, 1);
});
