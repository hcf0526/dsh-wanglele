import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";

const clientPath = fileURLToPath(new URL("../lib/client.js", import.meta.url));
const clientSource = readFileSync(clientPath, "utf8");

function loadClientModule() {
  let definition;
  const window = { __ModuleLoader__: { load: (entry) => { definition = entry; } } };
  runInNewContext(clientSource, { window });
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
    useState: (initial) => [initial, () => {}],
    useEffect: () => {},
  };
  return definition.factory((id) => {
    assert.equal(id, "react");
    return React;
  });
}

function findElement(node, type) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, type);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  if (node.type === type) return node;
  return findElement(node.children, type);
}

test("client module injects current DSH services and renders prompt editor", () => {
  const plugin = loadClientModule();
  assert.deepEqual(Array.from(plugin.inject), ["slots", "locale", "configForms"]);

  const slots = [];
  const entries = [];
  const locales = new Map();
  const form = {
    getSnapshot: () => ({
      status: "ready",
      writable: true,
      value: {
        customPromptEnabled: true,
        customPrompt: "Follow the current project conventions.",
        promptPosition: "replace",
      },
    }),
    subscribe: () => () => {},
  };
  const ctx = {
    effect: (effect) => effect(),
    locale: {
      register(ns, dictionaries) {
        locales.set(ns, dictionaries);
        return () => locales.delete(ns);
      },
      bind(ns) {
        return (key) => locales.get(ns)?.en?.[key] ?? key;
      },
    },
    configForms: { get: (entryId) => {
      assert.equal(entryId, "wanglele");
      return form;
    } },
    slots: {
      inject(name, register) {
        slots.push(name);
        register();
      },
      register(options, component) {
        entries.push({ options, component });
        return () => {};
      },
    },
  };

  plugin.apply(ctx);
  assert.deepEqual(slots, ["settings.section", "conversation.input.activity"]);
  assert.equal(entries[0].options.id, "wanglele-auto-retry");
  assert.equal(entries[1].options.id, "wanglele-auto-retry-input-toggle");
  assert.equal(locales.get("wanglele").zh.autoRetry, "自动重试");
  assert.equal(locales.get("wanglele").en.autoRetry, "Auto retry");
  assert.equal(typeof entries[0].component, "function");
  assert.equal(typeof entries[1].component, "function");
  const activityTree = entries[1].component(entries[1].options.inject());
  const activityView = activityTree.type(activityTree.props);
  assert.equal(findElement(activityView, "label").props.className, "wll-toggle wll-activity");
  assert.equal(findElement(activityView, "input").props.role, "switch");
  assert.match(JSON.stringify(activityView), /Auto retry/);
  const settingsTree = entries[0].component(entries[0].options.inject());
  const promptInput = findElement(settingsTree, "textarea");
  assert.ok(promptInput);
  assert.equal(promptInput.props.value, "Follow the current project conventions.");
  const positionSelect = findElement(settingsTree, "select");
  assert.ok(positionSelect);
  assert.equal(positionSelect.props.value, "replace");
  assert.deepEqual(positionSelect.children.map((option) => option.props.value), ["append", "prepend", "replace"]);
});
