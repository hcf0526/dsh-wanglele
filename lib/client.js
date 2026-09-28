window.__ModuleLoader__.load({
  id: "@wanglele/dsh-wanglele",
  factory: (require) => {
    const React = require("react");
    const h = React.createElement;
    const NS = "wanglele";

    const zh = {
      nav: "Wanglele",
      title: "自动重试",
      enabled: "启用自动重试",
      autoRetry: "自动重试",
      promptEnabled: "启用自定义系统提示词",
      promptLabel: "系统提示词内容",
      promptPlaceholder: "输入自定义系统提示词",
      promptPosition: "插入位置",
      append: "追加到末尾",
      prepend: "置于开头",
      replace: "仅使用自定义提示词",
      savePrompt: "保存提示词",
      delay: "失败后等待",
      delayHint: "等待结束后发送“继续”",
      maxFailures: "最大连续完全失败次数",
      maxFailuresHint: "达到次数后停止重试",
      seconds: "秒",
    };
    const en = {
      nav: "Wanglele",
      title: "Wanglele",
      enabled: "Enable auto retry",
      autoRetry: "Auto retry",
      promptEnabled: "Enable custom system prompt",
      promptLabel: "System prompt text",
      promptPlaceholder: "Enter a custom system prompt",
      promptPosition: "Position",
      append: "Append",
      prepend: "Prepend",
      replace: "Use custom prompt only",
      savePrompt: "Save prompt",
      delay: "Wait after failure",
      delayHint: "Send Continue after the delay",
      maxFailures: "Max consecutive empty failures",
      maxFailuresHint: "Stop after reaching this count",
      seconds: "sec",
    };

    function useForm(form) {
      return React.useSyncExternalStore(
        (listener) => form.subscribe(listener),
        () => form.getSnapshot(),
        () => ({ status: "loading", value: {} }),
      );
    }

    function RetryToggle({ t, form, enabled, field = "autoRetryEnabled", label, visibleLabel, disabled = false }) {
      const accessibleLabel = label ?? t("enabled");
      return h("label", {
        className: visibleLabel ? "wll-toggle wll-activity" : "wll-toggle",
        title: accessibleLabel,
      },
        h("input", {
          type: "checkbox",
          role: "switch",
          checked: enabled,
          "aria-checked": enabled,
          "aria-label": accessibleLabel,
          disabled,
          onChange: (event) => { void form.set(field, event.target.checked); },
        }),
        h("span", { className: "wll-track", "aria-hidden": true },
          h("span", { className: "wll-thumb" }),
        ),
        visibleLabel ? h("span", { className: "wll-activity-label" }, visibleLabel) : null,
      );
    }

    function SettingsSection({ t, form }) {
      const snapshot = useForm(form);
      const value = snapshot.value || {};
      const enabled = value.autoRetryEnabled ?? false;
      const promptEnabled = value.customPromptEnabled ?? false;
      const prompt = typeof value.customPrompt === "string" ? value.customPrompt : "";
      const promptPosition = ["append", "prepend", "replace"].includes(value.promptPosition) ? value.promptPosition : "append";
      const delay = typeof value.autoRetryDelaySeconds === "number" ? value.autoRetryDelaySeconds : 5;
      const maxFailures = typeof value.autoRetryMaxFailures === "number" ? value.autoRetryMaxFailures : 3;
      const writable = snapshot.status === "ready" && snapshot.writable;
      const [promptDraft, setPromptDraft] = React.useState(prompt);
      React.useEffect(() => setPromptDraft(prompt), [prompt]);

      return h("section", { className: "wll-settings" },
        h("div", { className: "wll-row" },
          h("span", { className: "wll-label" }, t("promptEnabled")),
          h(RetryToggle, {
            t,
            form,
            enabled: promptEnabled,
            field: "customPromptEnabled",
            label: t("promptEnabled"),
            disabled: !writable,
          }),
        ),
        promptEnabled
          ? h("div", { className: "wll-prompt-editor" },
              h("label", { className: "wll-label", htmlFor: "wll-prompt" }, t("promptLabel")),
              h("div", { className: "wll-position-row" },
                h("label", { className: "wll-label", htmlFor: "wll-prompt-position" }, t("promptPosition")),
                h("select", {
                  id: "wll-prompt-position",
                  className: "wll-select",
                  value: promptPosition,
                  disabled: !writable,
                  onChange: (event) => { void form.set("promptPosition", event.target.value); },
                },
                h("option", { value: "append" }, t("append")),
                h("option", { value: "prepend" }, t("prepend")),
                h("option", { value: "replace" }, t("replace")),
                ),
              ),
              h("textarea", {
                id: "wll-prompt",
                className: "wll-prompt-input",
                value: promptDraft,
                placeholder: t("promptPlaceholder"),
                disabled: !writable,
                onChange: (event) => setPromptDraft(event.target.value),
              }),
              h("button", {
                className: "wll-save",
                type: "button",
                disabled: !writable || promptDraft === prompt,
                onClick: () => { void form.set("customPrompt", promptDraft); },
              }, t("savePrompt")),
            )
          : null,
        h("div", { className: "wll-row" },
          h("span", { className: "wll-label" }, t("enabled")),
          h(RetryToggle, { t, form, enabled, disabled: !writable }),
        ),
        h("div", { className: "wll-row" },
          h("div", { className: "wll-field-copy" },
            h("label", { className: "wll-label", htmlFor: "wll-delay" }, t("delay")),
            h("span", { className: "wll-hint" }, t("delayHint")),
          ),
          h("div", { className: "wll-number-wrap" },
            h("input", {
              id: "wll-delay",
              className: "wll-number",
              type: "number",
              min: 1,
              max: 600,
              step: 1,
              disabled: !writable,
              value: delay,
              onChange: (event) => {
                const next = Number(event.target.value);
                if (Number.isInteger(next) && next >= 1 && next <= 600) void form.set("autoRetryDelaySeconds", next);
              },
            }),
            h("span", { className: "wll-hint" }, t("seconds")),
          ),
        ),
        h("div", { className: "wll-row" },
          h("div", { className: "wll-field-copy" },
            h("label", { className: "wll-label", htmlFor: "wll-max-failures" }, t("maxFailures")),
            h("span", { className: "wll-hint" }, t("maxFailuresHint")),
          ),
          h("input", {
            id: "wll-max-failures",
            className: "wll-number",
            type: "number",
            min: 1,
            max: 100,
            step: 1,
            disabled: !writable,
            value: maxFailures,
            onChange: (event) => {
              const next = Number(event.target.value);
              if (Number.isInteger(next) && next >= 1 && next <= 100) void form.set("autoRetryMaxFailures", next);
            },
          }),
        ),
      );
    }

    function ComposerToggle({ t, form }) {
      const snapshot = useForm(form);
      const enabled = snapshot.value?.autoRetryEnabled === true;
      return h(RetryToggle, {
        t,
        form,
        enabled,
        label: t("enabled"),
        visibleLabel: t("autoRetry"),
        disabled: snapshot.status !== "ready" || !snapshot.writable,
      });
    }

    const css = `
      .wll-settings { display: flex; flex-direction: column; color: var(--dsw-alias-label-primary, inherit); }
      .wll-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 52px; padding: 10px 0; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.18)); box-sizing: border-box; }
      .wll-row:last-child { border-bottom: 0; }
      .wll-field-copy { display: flex; flex: 1; flex-direction: column; gap: 4px; min-width: 0; }
      .wll-prompt-editor { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding: 4px 0 14px; }
      .wll-position-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; }
      .wll-select { box-sizing: border-box; width: min(240px, 60%); min-width: 140px; height: 32px; padding: 0 8px; color: var(--dsw-alias-label-primary, inherit); background: var(--dsw-alias-bg-control, transparent); border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3)); border-radius: 6px; }
      .wll-prompt-input { box-sizing: border-box; width: 100%; min-height: 160px; padding: 10px; resize: vertical; color: var(--dsw-alias-label-primary, inherit); background: var(--dsw-alias-bg-control, transparent); border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3)); border-radius: 6px; font: inherit; line-height: 1.5; }
      .wll-save { min-height: 32px; padding: 0 12px; color: var(--dsw-alias-label-primary, inherit); background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.12)); border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3)); border-radius: 6px; cursor: pointer; }
      .wll-save:disabled { opacity: .5; cursor: default; }
      .wll-label { color: var(--dsw-alias-label-primary, inherit); font-size: 13px; }
      .wll-hint { color: var(--dsw-alias-label-secondary, #8b8b8b); font-size: 12px; }
      .wll-number-wrap { display: flex; align-items: center; gap: 8px; }
      .wll-number { box-sizing: border-box; width: 88px; height: 32px; padding: 0 8px; color: var(--dsw-alias-label-primary, inherit); background: var(--dsw-alias-bg-control, transparent); border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3)); border-radius: 6px; }
      .wll-toggle { position: relative; display: inline-flex; flex: 0 0 38px; width: 38px; height: 22px; cursor: pointer; }
      .wll-toggle input { position: absolute; width: 1px; height: 1px; opacity: 0; }
      .wll-track { display: block; width: 38px; height: 22px; border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3)); border-radius: 12px; background: var(--dsw-alias-bg-control, rgba(127,127,127,.18)); transition: background .15s ease; }
      .wll-thumb { display: block; width: 16px; height: 16px; margin: 2px; border-radius: 50%; background: var(--dsw-alias-bg-layer-1, #fff); transition: transform .15s ease; }
      .wll-toggle input:checked + .wll-track { border-color: var(--dsw-alias-state-business-primary, #2878c8); background: var(--dsw-alias-state-business-primary, #2878c8); }
      .wll-toggle input:checked + .wll-track .wll-thumb { transform: translateX(16px); }
      .wll-toggle input:focus-visible + .wll-track { outline: 2px solid var(--dsw-alias-state-business-primary, #2878c8); outline-offset: 2px; }
      .wll-toggle input:disabled + .wll-track { opacity: .5; cursor: default; }
      .wll-activity { width: auto; flex: 0 0 auto; align-items: center; gap: 8px; }
      .wll-activity-label { color: var(--dsw-alias-label-primary, inherit); font-size: 13px; line-height: 1; white-space: nowrap; }
      .wll-activity .wll-track { box-sizing: border-box; width: 36px; height: 20px; border-radius: 999px; box-shadow: inset 0 1px 2px rgba(0,0,0,.08); transition: background .18s ease, border-color .18s ease, box-shadow .18s ease; }
      .wll-activity .wll-thumb { width: 14px; height: 14px; box-shadow: 0 1px 2px rgba(0,0,0,.2); transition: transform .18s cubic-bezier(.2,.7,.2,1); }
      .wll-activity input:checked + .wll-track .wll-thumb { transform: translateX(14px); }
      .wll-activity:hover .wll-track { box-shadow: 0 0 0 3px rgba(40,120,200,.12); }
      .wll-activity input:disabled + .wll-track { opacity: .42; }
      @media (prefers-reduced-motion: reduce) {
        .wll-activity .wll-track, .wll-activity .wll-thumb { transition: none; }
      }
    `;

    function apply(ctx) {
      const t = ctx.locale.bind(NS);
      const form = ctx.configForms.get(NS);
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "wanglele: locale");
      ctx.effect(() => {
        if (typeof document === "undefined" || document.getElementById("wll-retry-style")) return;
        const style = document.createElement("style");
        style.id = "wll-retry-style";
        style.textContent = css;
        document.head.appendChild(style);
        return () => style.remove();
      }, "wanglele: styles");
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: "wanglele-auto-retry",
        order: 35,
        label: () => t("nav"),
        locale: NS,
        inject: () => ({ t, form }),
      }, SettingsSection));
      ctx.slots.inject("conversation.input.activity", () => ctx.slots.register({
        name: "conversation.input.activity",
        id: "wanglele-auto-retry-input-toggle",
        order: 20,
        inject: () => ({ t, form }),
      }, ComposerToggle));
    }

    return {
      inject: ["slots", "locale", "configForms"],
      apply,
    };
  },
});
