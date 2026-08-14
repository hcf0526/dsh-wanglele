import test from "node:test";
import assert from "node:assert/strict";

import {
  apply,
  inject,
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

function captureAssemblyListener() {
  let registration;
  apply({
    on(event, listener, options) {
      registration = { event, listener, options };
    },
  });
  return registration;
}

test("exports a globally scoped DSH plugin", () => {
  assert.equal(name, "gpt-pwsh-compat");
  assert.deepEqual(inject, ["systemPrompt"]);

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
